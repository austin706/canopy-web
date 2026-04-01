import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { parseHomeInspection, type InspectionTask } from '@/services/ai';
import { supabase } from '@/services/supabase';
import { quickCompleteTask, quickSnoozeTask, quickSkipTask } from '@/services/utils';
import { Colors } from '@/constants/theme';
import type { MaintenanceTask } from '@/types';

const MAX_FILE_SIZE_MB = 500; // Supabase supports up to 5GB via resumable, 50GB via S3
const RESUMABLE_THRESHOLD_MB = 5; // Use resumable upload for files > 5MB
const PDF_JS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
const PDF_JS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

/**
 * Upload a file to Supabase Storage using resumable (TUS) protocol for large files,
 * falling back to standard upload for small files.
 */
async function uploadToStorage(
  file: File,
  storagePath: string,
  onProgress?: (pct: number) => void,
): Promise<{ error: Error | null }> {
  const fileSizeMB = file.size / (1024 * 1024);

  if (fileSizeMB <= RESUMABLE_THRESHOLD_MB) {
    // Small file — standard upload
    const { error } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, { contentType: file.type, upsert: true });
    return { error: error ? new Error(error.message) : null };
  }

  // Large file — resumable upload via TUS protocol
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { error: new Error('Not authenticated') };

  const projectRef = import.meta.env.VITE_SUPABASE_URL?.match(/\/\/([^.]+)\./)?.[1] || '';
  const tusEndpoint = `https://${projectRef}.supabase.co/storage/v1/upload/resumable`;
  const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB — required by Supabase TUS

  try {
    // Step 1: Create the upload
    const createRes = await fetch(tusEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        'Tus-Resumable': '1.0.0',
        'Upload-Length': String(file.size),
        'Upload-Metadata': [
          `bucketName ${btoa('documents')}`,
          `objectName ${btoa(storagePath)}`,
          `contentType ${btoa(file.type || 'application/pdf')}`,
        ].join(','),
        'x-upsert': 'true',
      },
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return { error: new Error(`Upload init failed: ${createRes.status} ${errText}`) };
    }

    const uploadUrl = createRes.headers.get('Location');
    if (!uploadUrl) return { error: new Error('No upload URL returned') };

    // Step 2: Upload in chunks
    let offset = 0;
    while (offset < file.size) {
      const end = Math.min(offset + CHUNK_SIZE, file.size);
      const chunk = file.slice(offset, end);

      const patchRes = await fetch(uploadUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': String(offset),
          'Content-Type': 'application/offset+octet-stream',
        },
        body: chunk,
      });

      if (!patchRes.ok) {
        const errText = await patchRes.text();
        return { error: new Error(`Chunk upload failed at ${offset}: ${patchRes.status} ${errText}`) };
      }

      const newOffset = patchRes.headers.get('Upload-Offset');
      offset = newOffset ? parseInt(newOffset, 10) : end;
      onProgress?.(Math.round((offset / file.size) * 100));
    }

    return { error: null };
  } catch (err: any) {
    return { error: new Error(err.message || 'Resumable upload failed') };
  }
}

/** Dynamically load pdf.js from CDN (cached after first load) */
let pdfjsLib: any = null;
async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import(/* @vite-ignore */ PDF_JS_CDN);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_CDN;
  return pdfjsLib;
}

/** Extract text from all pages of a PDF using pdf.js — returns per-page texts for batching */
async function extractPdfText(file: File, onProgress?: (page: number, total: number) => void): Promise<{ text: string; pageTexts: string[]; pageCount: number }> {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    onProgress?.(i, pageCount);
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item: any) => item.str)
        .join(' ')
        .trim();
      // Always push an entry (empty string for blank pages) to keep indices aligned with page numbers
      pageTexts.push(text || '');
    } catch {
      pageTexts.push('');
    }
  }

  // Build combined text for backward compat (only non-empty pages)
  const combinedParts = pageTexts
    .map((t, i) => t ? `--- Page ${i + 1} ---\n${t}` : '')
    .filter(Boolean);

  return { text: combinedParts.join('\n\n'), pageTexts, pageCount };
}

/** Render specific PDF pages to images using pdf.js canvas rendering */
async function renderPdfPagesToImages(
  file: File,
  pageNumbers: number[],
  scale = 1.5,
  onProgress?: (page: number, total: number) => void,
): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  for (let i = 0; i < pageNumbers.length; i++) {
    onProgress?.(i + 1, pageNumbers.length);
    try {
      const page = await pdf.getPage(pageNumbers[i]);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      const base64 = dataUrl.split(',')[1];
      if (base64) images.push(base64);
    } catch {
      // Skip unrenderable pages
    }
  }

  return images;
}

/** Stitch multiple base64 JPEG images into a single vertical strip for batch AI analysis */
async function stitchImagesVertically(base64Images: string[], maxWidth = 1200): Promise<string> {
  if (base64Images.length === 1) return base64Images[0];

  // Load all images to get dimensions
  const imgs: HTMLImageElement[] = await Promise.all(
    base64Images.map(b64 => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = `data:image/jpeg;base64,${b64}`;
    }))
  );

  // Calculate scaled dimensions — fit all to maxWidth
  const scaledDims = imgs.map(img => {
    const scale = Math.min(1, maxWidth / img.width);
    return { w: Math.round(img.width * scale), h: Math.round(img.height * scale) };
  });

  const totalWidth = maxWidth;
  const totalHeight = scaledDims.reduce((sum, d) => sum + d.h, 0);

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed for stitching');

  // Draw each image stacked vertically
  let y = 0;
  for (let i = 0; i < imgs.length; i++) {
    ctx.drawImage(imgs[i], 0, y, scaledDims[i].w, scaledDims[i].h);
    y += scaledDims[i].h;
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
  const base64 = dataUrl.split(',')[1];
  if (!base64) throw new Error('Empty stitched image');
  return base64;
}

/** Compress, resize, and convert an image file to JPEG for the AI inspection parser. */
async function compressInspectionImageFromFile(file: File, maxWidth = 1600, maxHeight = 1600, quality = 0.7): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const compressed = canvas.toDataURL('image/jpeg', quality);
  const base64 = compressed.split(',')[1];
  if (!base64) throw new Error('Empty base64 output');
  return base64;
}

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#C62828',
  high: '#E65100',
  medium: Colors.copper,
  low: Colors.sage,
};

const TIMEFRAME_LABELS: Record<string, string> = {
  immediately: 'Immediately',
  within_30_days: 'Within 30 days',
  within_3_months: 'Within 3 months',
  within_6_months: 'Within 6 months',
  within_1_year: 'Within 1 year',
  annual_maintenance: 'Annual maintenance',
};

function getDueDateFromTimeframe(timeframe: string): string {
  const now = new Date();
  switch (timeframe) {
    case 'immediately':
      return now.toISOString().split('T')[0];
    case 'within_30_days':
      now.setDate(now.getDate() + 30);
      return now.toISOString().split('T')[0];
    case 'within_3_months':
      now.setMonth(now.getMonth() + 3);
      return now.toISOString().split('T')[0];
    case 'within_6_months':
      now.setMonth(now.getMonth() + 6);
      return now.toISOString().split('T')[0];
    case 'within_1_year':
      now.setFullYear(now.getFullYear() + 1);
      return now.toISOString().split('T')[0];
    case 'annual_maintenance':
      now.setMonth(now.getMonth() + 6);
      return now.toISOString().split('T')[0];
    default:
      now.setMonth(now.getMonth() + 3);
      return now.toISOString().split('T')[0];
  }
}

interface Props {
  onTasksCreated?: (count: number) => void;
}

export default function InspectionUploader({ onTasksCreated }: Props) {
  const { user, home, setTasks } = useStore();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reuploadFileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [tasks, setLocalTasks] = useState<InspectionTask[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [progress, setProgress] = useState('');
  const [taskTimeframes, setTaskTimeframes] = useState<Map<number, string>>(new Map());
  const [proRequestTasks, setProRequestTasks] = useState<Set<number>>(new Set());
  const [proRequestsCreated, setProRequestsCreated] = useState(0);
  const inspectionFileRef = useRef<File | null>(null);
  const [existingInspection, setExistingInspection] = useState<{ title: string; created_at: string; file_url: string } | null>(null);
  const [inspectionTasks, setInspectionTasks] = useState<any[]>([]);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [showUploadNew, setShowUploadNew] = useState(false);
  const [expandTasks, setExpandTasks] = useState(false);
  const [showConfirmUploadNew, setShowConfirmUploadNew] = useState(false);
  const [reuploadingDoc, setReuploadingDoc] = useState(false);
  const [snoozeTaskId, setSnoozeTaskId] = useState<string | null>(null);

  // Check if this home already has an uploaded inspection + load its tasks
  useEffect(() => {
    if (!home) return;
    const check = async () => {
      try {
        // Fetch the most recent inspection document
        const { data } = await supabase
          .from('documents')
          .select('title, created_at, file_url')
          .eq('home_id', home.id)
          .eq('category', 'inspection')
          .order('created_at', { ascending: false })
          .limit(1);
        if (data && data.length > 0) {
          setExistingInspection(data[0]);

          // Get a signed URL for viewing the report
          try {
            const { data: urlData } = await supabase.storage
              .from('documents')
              .createSignedUrl(data[0].file_url, 3600); // 1 hour
            if (urlData?.signedUrl) setReportUrl(urlData.signedUrl);
          } catch {
            // Storage URL failed — report will be viewable without direct link
          }

          // Load tasks that came from inspection
          try {
            const { data: taskData } = await supabase
              .from('maintenance_tasks')
              .select('id, title, status, priority, category, due_date, estimated_cost, notes')
              .eq('home_id', home.id)
              .like('notes', 'From home inspection:%')
              .order('priority', { ascending: true });
            if (taskData) setInspectionTasks(taskData);
          } catch {
            // Tasks load failed — show report without tasks
          }
        }
      } catch (err) {
        console.warn('Failed to check existing inspection:', err);
      } finally {
        setCheckingExisting(false);
      }
    };
    check();
  }, [home]);

  /** Re-upload just the PDF file to storage (without re-parsing tasks) */
  const handleReuploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !home) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setReuploadingDoc(true);
    setError('');
    try {
      const storagePath = `${user.id}/inspections/${Date.now()}_${file.name}`;
      const { error: uploadError } = await uploadToStorage(file, storagePath, (pct) => {
        setError(`Uploading... ${pct}%`);
      });
      setError('');

      if (uploadError) throw uploadError;

      // Update the existing document record with the new file URL
      await supabase.from('documents')
        .update({ file_url: storagePath, title: file.name })
        .eq('home_id', home.id)
        .eq('category', 'inspection')
        .order('created_at', { ascending: false })
        .limit(1);

      // Refresh the signed URL
      const { data: urlData } = await supabase.storage
        .from('documents')
        .createSignedUrl(storagePath, 3600);
      if (urlData?.signedUrl) setReportUrl(urlData.signedUrl);

      setExistingInspection(prev => prev ? { ...prev, file_url: storagePath, title: file.name } : prev);
    } catch (err: any) {
      setError(`Failed to upload document: ${err.message}`);
    } finally {
      setReuploadingDoc(false);
    }
  };

  /** Handle quick actions on inspection tasks and refresh the local list */
  const handleQuickAction = async (taskId: string, action: 'complete' | 'skip' | 'snooze', days?: number) => {
    const task = inspectionTasks.find((t: any) => t.id === taskId);
    if (!task) return;
    // Cast to MaintenanceTask shape for utils (inspection tasks have the required fields)
    const mt = task as MaintenanceTask;
    if (action === 'complete') await quickCompleteTask(mt);
    else if (action === 'skip') await quickSkipTask(mt);
    else if (action === 'snooze' && days) await quickSnoozeTask(mt, days);
    setSnoozeTaskId(null);
    // Refresh inspection tasks from DB
    if (home) {
      const { data } = await supabase
        .from('maintenance_tasks')
        .select('id, title, status, priority, category, due_date, estimated_cost, notes')
        .eq('home_id', home.id)
        .like('notes', 'From home inspection:%')
        .order('priority', { ascending: true });
      if (data) setInspectionTasks(data);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // File size check
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setFileName(file.name);
    inspectionFileRef.current = file;
    setError('');
    setParsing(true);
    setProgress('');

    try {
      let documentText = '';
      let imageBase64: string | undefined;

      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        // Use pdf.js for proper text extraction from PDFs
        setProgress('Loading PDF library...');

        const { text, pageCount } = await extractPdfText(file, (page, total) => {
          setProgress(`Extracting text: page ${page} of ${total}...`);
        });

        // Check if we got meaningful text (at least ~20 chars per page on average)
        const hasGoodText = text.length > pageCount * 20;

        if (hasGoodText) {
          // Text-rich PDF — use text extraction (faster, more accurate than vision OCR)
          // Claude's context window (200K tokens) easily handles full inspection reports.
          // Sending the full text in ONE call avoids duplicate extraction from summary vs body.
          const MAX_TEXT_LENGTH = 200000; // ~50K tokens — well within Claude's context

          if (text.length <= MAX_TEXT_LENGTH) {
            // Full report fits in a single API call — best quality, no dedup needed
            documentText = `Home Inspection Report (${file.name}, ${pageCount} pages).\n` +
              `IMPORTANT: This report likely contains a SUMMARY section followed by DETAILED sections that repeat the same findings with photos. ` +
              `Extract each finding ONCE — prefer the detailed version but do NOT create duplicate tasks for the same issue.\n\n${text}`;
            setProgress('Analyzing report with AI...');
          } else {
            // Extremely large report — truncate to fit (very rare for inspection reports)
            const trimmed = text.substring(0, MAX_TEXT_LENGTH) + '\n\n[Report truncated due to length]';
            documentText = `Home Inspection Report (${file.name}, ${pageCount} pages).\n` +
              `IMPORTANT: This report likely contains a SUMMARY section followed by DETAILED sections that repeat the same findings with photos. ` +
              `Extract each finding ONCE — prefer the detailed version but do NOT create duplicate tasks for the same issue.\n\n${trimmed}`;
            setProgress('Analyzing report with AI...');
          }
        } else {
          // Image-based PDF — use vision batching for OCR extraction
          setProgress('PDF is image-based, rendering pages for AI vision analysis...');

          const allPages: number[] = [];
          for (let i = 1; i <= pageCount; i++) allPages.push(i);

          // Render at 1.5x scale for readable text — critical for extracting specific details
          const allImages = await renderPdfPagesToImages(file, allPages, 1.5, (page, total) => {
            setProgress(`Rendering page ${page} of ${total}...`);
          });

          if (allImages.length === 0) {
            throw new Error('Could not read any pages from this PDF. The file may be corrupted or password-protected.');
          }

          // Process in batches — each batch sends one stitched image to the AI
          // Stitch ~3 pages per batch for maximum detail extraction
          const PAGES_PER_BATCH = 3;
          const batches: string[][] = [];
          for (let i = 0; i < allImages.length; i += PAGES_PER_BATCH) {
            batches.push(allImages.slice(i, i + PAGES_PER_BATCH));
          }

          // Run TWO fully independent extraction passes and merge results.
          // Each pass independently extracts tasks from every batch — the union of two
          // independent runs catches items that any single run might miss due to AI variance.
          const NUM_PASSES = 2;
          const allTasks: InspectionTask[] = [];

          for (let pass = 1; pass <= NUM_PASSES; pass++) {
            for (let b = 0; b < batches.length; b++) {
              const batch = batches[b];
              const startPage = b * PAGES_PER_BATCH + 1;
              const endPage = Math.min(startPage + batch.length - 1, pageCount);
              const totalBatches = batches.length * NUM_PASSES;
              const currentBatch = (pass - 1) * batches.length + b + 1;
              setProgress(`Analyzing pages ${startPage}–${endPage} (${currentBatch}/${totalBatches})...`);

              const stitchedBase64 = await stitchImagesVertically(batch);

              // Vary the prompt slightly between passes to get different extraction angles
              const context = pass === 1
                ? `Home Inspection Report (${file.name}), pages ${startPage}–${endPage} of ${pageCount}. ` +
                  `Extract EVERY INDIVIDUAL finding visible on these pages. Be SPECIFIC: include exact locations (e.g., "left side", "master bathroom", "3-car garage"). ` +
                  `Each checkbox, deficiency, photo annotation, or recommendation = one separate task. ` +
                  `Do NOT consolidate — "rotted wood on main home" and "rotted wood on garage" are TWO tasks. ` +
                  `Use the inspector's exact language, not generic summaries.`
                : `Home Inspection Report (${file.name}), pages ${startPage}–${endPage} of ${pageCount}. ` +
                  `Carefully examine EVERY section, checkbox, photo, and annotation on these pages. ` +
                  `For EACH deficiency, safety concern, recommendation, or maintenance item, create a separate task. ` +
                  `Be thorough: include items marked Repair, Replace, Monitor, Safety, Improvement, AND routine maintenance tips. ` +
                  `Include SPECIFIC locations in every title. Do NOT skip minor items or consolidate similar findings.`;

              try {
                const batchResult = await parseHomeInspection(context, stitchedBase64);
                allTasks.push(...batchResult);
              } catch (err: any) {
                console.warn(`Pass ${pass} batch ${b + 1} failed:`, err.message);
              }
            }
          }

          if (allTasks.length === 0) {
            throw new Error('AI could not extract any maintenance tasks from this report. The pages may contain only photos or non-inspection content.');
          }

          console.log(`Total tasks before dedup: ${allTasks.length} (from ${NUM_PASSES} passes × ${batches.length} batches)`);

          // Deduplicate tasks — exact key match + fuzzy title similarity
          const normalizeKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');
          const seen = new Set<string>();
          const seenTitles: string[] = [];

          const LOCATION_WORDS = new Set([
            'front', 'back', 'rear', 'left', 'right', 'north', 'south', 'east', 'west',
            'ne', 'nw', 'se', 'sw', 'upper', 'lower', 'main', 'master', 'guest',
            'garage', '1-car', '2-car', '3-car', 'detached', 'attached', 'basement',
            'attic', 'crawl', 'kitchen', 'bathroom', 'bedroom', 'living', 'family',
            'foyer', 'hallway', 'laundry', 'closet', 'patio', 'deck', 'porch',
            'pool', 'chimney', 'exterior', 'interior', 'upstairs', 'downstairs',
          ]);

          const isSimilar = (a: string, b: string): boolean => {
            const na = normalizeKey(a);
            const nb = normalizeKey(b);
            if (na === nb) return true;
            if (na.length > nb.length + 10 && na.includes(nb)) return true;
            if (nb.length > na.length + 10 && nb.includes(na)) return true;

            const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
            const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
            if (wordsA.size === 0 || wordsB.size === 0) return false;

            const overlap = [...wordsA].filter(w => wordsB.has(w)).length;
            const smaller = Math.min(wordsA.size, wordsB.size);
            const ratio = smaller > 0 ? overlap / smaller : 0;

            const locA = [...wordsA].filter(w => LOCATION_WORDS.has(w));
            const locB = [...wordsB].filter(w => LOCATION_WORDS.has(w));
            const locOverlap = locA.filter(w => locB.includes(w)).length;
            const hasDistinctLocations = (locA.length > 0 || locB.length > 0) &&
              (locA.length !== locB.length || locOverlap < Math.max(locA.length, locB.length));

            if (hasDistinctLocations) {
              return overlap >= 4 && ratio >= 0.9;
            }

            return overlap >= 3 && ratio >= 0.8;
          };

          const dedupedTasks = allTasks.filter(task => {
            const key = normalizeKey(task.title);
            if (seen.has(key)) return false;
            if (seenTitles.some(prev => isSimilar(task.title, prev))) return false;
            seen.add(key);
            seenTitles.push(task.title);
            return true;
          });

          setLocalTasks(dedupedTasks);
          setSelectedTasks(new Set(dedupedTasks.map((_, i) => i)));
          setStep('review');
          return; // Skip the single-call path below
        }
      } else if (file.type.startsWith('image/')) {
        // Image file — compress and convert to JPEG directly from File object
        // Uses createImageBitmap for maximum format compatibility (HEIC, WebP, etc.)
        setProgress('Compressing image...');
        imageBase64 = await compressInspectionImageFromFile(file, 1600, 1600, 0.8);
        setProgress('Analyzing image with AI...');
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        documentText = await file.text();
        setProgress('Analyzing report with AI...');
      } else {
        // Try reading as text
        try {
          documentText = await file.text();
          setProgress('Analyzing report with AI...');
        } catch {
          throw new Error('Unsupported file format. Please upload a PDF, image, or text file.');
        }
      }

      const result = await parseHomeInspection(documentText, imageBase64);

      setLocalTasks(result);
      // Select all by default
      setSelectedTasks(new Set(result.map((_, i) => i)));
      setStep('review');
    } catch (err: any) {
      console.error('Error parsing inspection:', err);
      setError(err.message || 'Failed to parse inspection document');
    } finally {
      setParsing(false);
      setProgress('');
    }
  };

  const toggleTask = (index: number) => {
    const next = new Set(selectedTasks);
    next.has(index) ? next.delete(index) : next.add(index);
    setSelectedTasks(next);
  };

  const selectAll = () => setSelectedTasks(new Set(tasks.map((_, i) => i)));
  const selectNone = () => setSelectedTasks(new Set());

  const handleCreateTasks = async () => {
    if (!home || !user || selectedTasks.size === 0) return;

    setSaving(true);
    try {
      const tasksToInsert = Array.from(selectedTasks).map(index => {
        const task = tasks[index];
        const overriddenTimeframe = taskTimeframes.get(index) || task.recommended_timeframe;
        return {
          home_id: home.id,
          title: task.title,
          description: task.description,
          category: task.category,
          priority: task.priority,
          status: 'upcoming' as const,
          due_date: getDueDateFromTimeframe(overriddenTimeframe),
          estimated_cost: task.estimated_cost,
          notes: `From home inspection: ${task.inspection_section}`,
          frequency: 'as_needed' as const,
        };
      });

      const { data: created, error: insertError } = await supabase
        .from('maintenance_tasks')
        .insert(tasksToInsert)
        .select();

      if (insertError) throw insertError;

      if (created) {
        // Update store with new tasks
        const { tasks: existingTasks } = useStore.getState();
        setTasks([...existingTasks, ...created]);
      }

      // Save the original inspection file to Supabase Storage + documents table
      const fileToUpload = inspectionFileRef.current;
      let fileUploadSucceeded = false;
      if (fileToUpload) {
        const storagePath = `${user.id}/inspections/${Date.now()}_${fileToUpload.name}`;

        try {
          const { error: uploadError } = await uploadToStorage(fileToUpload, storagePath);

          if (uploadError) {
            console.warn('Storage upload failed:', uploadError.message);
            // Still save the document record without file_url so the summary view works
          } else {
            fileUploadSucceeded = true;
          }
        } catch (storageErr: any) {
          console.warn('Storage upload exception:', storageErr?.message);
        }

        // Always save the document record — with or without the file URL
        try {
          const { error: docError } = await supabase.from('documents').insert({
            home_id: home.id,
            user_id: user.id,
            title: fileToUpload.name,
            category: 'inspection',
            file_url: fileUploadSucceeded ? storagePath : null,
          });
          if (!docError) {
            setExistingInspection({
              title: fileToUpload.name,
              created_at: new Date().toISOString(),
              file_url: fileUploadSucceeded ? storagePath : '',
            });
          }
        } catch (docErr: any) {
          console.warn('Document record insert failed:', docErr?.message);
        }

        if (!fileUploadSucceeded) {
          setError('Tasks were saved, but the inspection file was too large to upload. You can re-upload a smaller version later.');
        }
      }

      // Handle pro requests — group by category
      let proRequestCount = 0;
      if (proRequestTasks.size > 0) {
        const proTasksByCategory: Record<string, { task: InspectionTask; index: number }[]> = {};

        Array.from(proRequestTasks).forEach(index => {
          const task = tasks[index];
          if (!proTasksByCategory[task.category]) {
            proTasksByCategory[task.category] = [];
          }
          proTasksByCategory[task.category].push({ task, index });
        });

        // Create one pro_request per category
        const proRequestsToInsert = Object.entries(proTasksByCategory).map(([category, items]) => {
          const highestPriority = items.reduce((max, curr) => {
            const priorityOrder: Record<string, number> = { urgent: 3, high: 2, medium: 1, low: 0 };
            return (priorityOrder[curr.task.priority] || 0) > (priorityOrder[max.task.priority] || 0) ? curr : max;
          });

          const urgency = ['urgent', 'high'].includes(highestPriority.task.priority) ? 'urgent' : 'routine';
          const description = items.map(({ task }) => task.title).join('; ');

          return {
            user_id: user.id,
            home_id: home.id,
            category,
            description,
            urgency,
            status: 'pending' as const,
            source: 'inspection' as const,
          };
        });

        const { data: createdRequests, error: proError } = await supabase
          .from('pro_requests')
          .insert(proRequestsToInsert)
          .select();

        if (proError) throw proError;

        // Link each pro task to its request via join table
        if (createdRequests && created) {
          const proTaskLinks: any[] = [];
          createdRequests.forEach(request => {
            const categoryTasks = proTasksByCategory[request.category];
            categoryTasks.forEach(({ index }) => {
              const createdTask = created[index];
              if (createdTask) {
                proTaskLinks.push({
                  request_id: request.id,
                  task_id: createdTask.id,
                });
              }
            });
          });

          if (proTaskLinks.length > 0) {
            const { error: linkError } = await supabase
              .from('pro_request_tasks')
              .insert(proTaskLinks);
            if (linkError) throw linkError;
          }
        }

        proRequestCount = createdRequests?.length || 0;
      }

      setProRequestsCreated(proRequestCount);
      setStep('done');
      onTasksCreated?.(selectedTasks.size);
    } catch (err: any) {
      console.error('Error creating tasks:', err);
      setError(err.message || 'Failed to create tasks');
    } finally {
      setSaving(false);
    }
  };

  // Group tasks by section for display
  const groupedTasks = tasks.reduce((acc, task, index) => {
    const section = task.inspection_section || 'General';
    if (!acc[section]) acc[section] = [];
    acc[section].push({ task, index });
    return acc;
  }, {} as Record<string, { task: InspectionTask; index: number }[]>);

  // Upload step
  if (step === 'upload') {
    if (checkingExisting) {
      return <div style={{ textAlign: 'center', padding: 40, color: Colors.medGray }}>Checking for existing inspection...</div>;
    }

    if (existingInspection && !showUploadNew) {
      const completedCount = inspectionTasks.filter(t => t.status === 'completed').length;
      const overdueCount = inspectionTasks.filter(t => t.status === 'overdue').length;
      const upcomingCount = inspectionTasks.filter(t => t.status === 'upcoming' || t.status === 'due').length;
      const totalCost = inspectionTasks.reduce((sum: number, t: any) => sum + (t.estimated_cost || 0), 0);
      const hasFileUrl = existingInspection.file_url && existingInspection.file_url.length > 0;

      return (
        <div>
          {/* Confirmation dialog for Upload New */}
          {showConfirmUploadNew && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.4)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
              onClick={() => setShowConfirmUploadNew(false)}
            >
              <div style={{
                background: '#fff', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%',
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              }}
                onClick={e => e.stopPropagation()}
              >
                <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>Upload New Inspection?</h3>
                <p style={{ fontSize: 13, color: Colors.medGray, margin: '0 0 20px', lineHeight: 1.5 }}>
                  This will upload and analyze a new inspection report. What would you like to do with your existing {inspectionTasks.length} inspection tasks?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setShowConfirmUploadNew(false);
                      setShowUploadNew(true);
                    }}
                  >
                    Keep Existing Tasks & Upload New
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: Colors.error }}
                    onClick={async () => {
                      // Delete existing inspection tasks then proceed
                      if (home) {
                        await supabase.from('maintenance_tasks')
                          .update({ deleted_at: new Date().toISOString() })
                          .eq('home_id', home.id)
                          .like('notes', 'From home inspection:%');
                        setInspectionTasks([]);
                      }
                      setShowConfirmUploadNew(false);
                      setShowUploadNew(true);
                    }}
                  >
                    Clear Tasks & Upload New
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowConfirmUploadNew(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Hidden file input for re-uploading just the document */}
          <input
            ref={reuploadFileRef}
            type="file"
            accept=".pdf"
            onChange={handleReuploadDocument}
            style={{ display: 'none' }}
          />

          {/* Report header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            padding: '16px 0', borderBottom: '1px solid #f3f4f6', marginBottom: 16,
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 20 }}>&#128203;</span>
                <p style={{ fontSize: 15, fontWeight: 600, color: Colors.charcoal, margin: 0 }}>
                  {existingInspection.title}
                </p>
              </div>
              <p style={{ fontSize: 12, color: Colors.medGray, margin: 0 }}>
                Uploaded {new Date(existingInspection.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {reportUrl && (
                <a
                  href={reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, textDecoration: 'none', color: Colors.copper }}
                >
                  View Report
                </a>
              )}
              {!hasFileUrl && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: 12, color: Colors.copper, fontWeight: 600 }}
                  onClick={() => reuploadFileRef.current?.click()}
                  disabled={reuploadingDoc}
                >
                  {reuploadingDoc ? 'Uploading...' : 'Re-upload PDF'}
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 12, color: Colors.medGray }}
                onClick={() => {
                  if (inspectionTasks.length > 0) {
                    setShowConfirmUploadNew(true);
                  } else {
                    setShowUploadNew(true);
                  }
                }}
              >
                Upload New
              </button>
            </div>
          </div>

          {/* Error message (e.g., re-upload failure) */}
          {error && (
            <div style={{
              marginBottom: 12, padding: '10px 14px', borderRadius: 8,
              background: '#FEF3CD', border: '1px solid #FFC107',
              fontSize: 13, color: '#856404',
            }}>
              {error}
            </div>
          )}

          {/* Task summary stats */}
          {inspectionTasks.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: '#f9f9f7', textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: Colors.sage, margin: 0 }}>{completedCount}</p>
                  <p style={{ fontSize: 11, color: Colors.medGray, margin: '2px 0 0' }}>Completed</p>
                </div>
                <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: '#f9f9f7', textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 700, color: Colors.copper, margin: 0 }}>{upcomingCount}</p>
                  <p style={{ fontSize: 11, color: Colors.medGray, margin: '2px 0 0' }}>Remaining</p>
                </div>
                {overdueCount > 0 && (
                  <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: '#FFF3E0', textAlign: 'center' }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: Colors.error, margin: 0 }}>{overdueCount}</p>
                    <p style={{ fontSize: 11, color: Colors.medGray, margin: '2px 0 0' }}>Overdue</p>
                  </div>
                )}
                {totalCost > 0 && (
                  <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: '#f9f9f7', textAlign: 'center' }}>
                    <p style={{ fontSize: 20, fontWeight: 700, color: Colors.charcoal, margin: 0 }}>${totalCost.toLocaleString()}</p>
                    <p style={{ fontSize: 11, color: Colors.medGray, margin: '2px 0 0' }}>Est. Total</p>
                  </div>
                )}
              </div>

              {/* Task list — collapsible */}
              <button
                onClick={() => setExpandTasks(!expandTasks)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer',
                  borderTop: '1px solid #f3f4f6', fontSize: 14, fontWeight: 600, color: Colors.charcoal,
                }}
              >
                <span>{inspectionTasks.length} Inspection Tasks</span>
                <span style={{ fontSize: 11, color: Colors.medGray }}>{expandTasks ? '\u25B2 Hide' : '\u25BC Show All'}</span>
              </button>

              {expandTasks && (
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                  {inspectionTasks.map((task: any) => {
                    const statusColor = task.status === 'completed' ? Colors.sage
                      : task.status === 'overdue' ? Colors.error
                      : task.status === 'due' ? Colors.warning : Colors.medGray;
                    const priorityColor = PRIORITY_COLORS[task.priority] || Colors.medGray;
                    const isActive = task.status !== 'completed' && task.status !== 'skipped';
                    return (
                      <div key={task.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 4px', borderBottom: '1px solid #f9f9f7',
                        opacity: task.status === 'completed' ? 0.6 : 1,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                        onClick={() => navigate(`/task/${task.id}`)}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#f5f5f3'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                      >
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', background: priorityColor, flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            fontSize: 13, fontWeight: 500, margin: 0,
                            textDecoration: task.status === 'completed' ? 'line-through' : 'none',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {task.title}
                          </p>
                          <p style={{ fontSize: 11, color: Colors.medGray, margin: '2px 0 0' }}>
                            {task.category}
                            {task.due_date && ` · Due ${new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                            {task.estimated_cost > 0 && ` · ~$${task.estimated_cost}`}
                          </p>
                        </div>

                        {/* Quick action buttons */}
                        {isActive && (
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            <button
                              title="Mark complete"
                              onClick={() => handleQuickAction(task.id, 'complete')}
                              style={{
                                width: 28, height: 28, borderRadius: 6, border: `1px solid ${Colors.sage}`,
                                background: 'transparent', cursor: 'pointer', fontSize: 13, color: Colors.sage,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >&#10003;</button>
                            <div style={{ position: 'relative' }}>
                              <button
                                title="Snooze"
                                onClick={() => setSnoozeTaskId(snoozeTaskId === task.id ? null : task.id)}
                                style={{
                                  width: 28, height: 28, borderRadius: 6, border: `1px solid ${Colors.copper}`,
                                  background: 'transparent', cursor: 'pointer', fontSize: 13, color: Colors.copper,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >&#9203;</button>
                              {snoozeTaskId === task.id && (
                                <div style={{
                                  position: 'absolute', right: 0, top: 32, background: '#fff', borderRadius: 8,
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)', zIndex: 10, minWidth: 120, overflow: 'hidden',
                                }}>
                                  {[{ days: 3, label: '3 days' }, { days: 7, label: '1 week' }, { days: 14, label: '2 weeks' }, { days: 30, label: '1 month' }].map(opt => (
                                    <button
                                      key={opt.days}
                                      onClick={() => handleQuickAction(task.id, 'snooze', opt.days)}
                                      style={{
                                        display: 'block', width: '100%', padding: '8px 14px', border: 'none',
                                        background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 12,
                                        color: Colors.charcoal,
                                      }}
                                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f5f5f3'; }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              title="Skip"
                              onClick={() => handleQuickAction(task.id, 'skip')}
                              style={{
                                width: 28, height: 28, borderRadius: 6, border: `1px solid ${Colors.medGray}`,
                                background: 'transparent', cursor: 'pointer', fontSize: 13, color: Colors.medGray,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >&#10005;</button>
                          </div>
                        )}

                        {!isActive && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                            background: `${statusColor}15`, color: statusColor, textTransform: 'capitalize',
                            whiteSpace: 'nowrap',
                          }}>
                            {task.status}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {inspectionTasks.length === 0 && (
            <p style={{ fontSize: 13, color: Colors.medGray, textAlign: 'center', padding: '12px 0' }}>
              No tasks were created from this inspection report.
            </p>
          )}
        </div>
      );
    }

    return (
      <div>
        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${Colors.copperLight}`,
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
            cursor: 'pointer',
            background: parsing ? '#f5f5f5' : Colors.copperMuted,
            transition: 'all 0.2s ease',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt,.doc,.docx"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {parsing ? (
            <>
              <style>{`
                @keyframes inspectionSpin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
                @keyframes inspectionPulse {
                  0%, 100% { opacity: 0.6; }
                  50% { opacity: 1; }
                }
              `}</style>
              <div style={{
                width: 64, height: 64,
                borderRadius: '50%',
                border: `3px dashed ${Colors.copper}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'inspectionSpin 3s linear infinite',
                marginBottom: 16,
              }}>
                <span style={{ fontSize: 28, animation: 'none' }}>&#128270;</span>
              </div>
              <p style={{ fontSize: 16, fontWeight: 600, color: Colors.charcoal }}>
                Analyzing inspection report...
              </p>
              <p style={{ fontSize: 13, color: Colors.medGray, marginTop: 4 }}>
                {fileName}
              </p>
              <p style={{ fontSize: 13, color: Colors.copper, fontWeight: 500, animation: 'inspectionPulse 2s ease-in-out infinite' }}>
                {progress || 'AI is reading and extracting maintenance items...'}
              </p>
              <p style={{ fontSize: 12, color: Colors.medGray, marginTop: 12, fontStyle: 'italic' }}>
                Please stay on this page while analysis completes
              </p>
            </>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 12 }}>&#128196;</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: Colors.copper }}>
                Upload Home Inspection Report
              </p>
              <p style={{ fontSize: 13, color: Colors.medGray, marginTop: 4 }}>
                PDF, images, or text files accepted
              </p>
              <p style={{ fontSize: 12, color: Colors.medGray, marginTop: 12 }}>
                Our AI will read the inspection and create maintenance tasks based on the recommendations.
              </p>
            </>
          )}
        </div>

        {error && (
          <div style={{
            marginTop: 12,
            padding: '10px 14px',
            borderRadius: 8,
            background: '#E5393520',
            color: '#C62828',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // Review step
  if (step === 'review') {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>
              {tasks.length} item{tasks.length !== 1 ? 's' : ''} found
            </h3>
            <p style={{ fontSize: 13, color: Colors.medGray, margin: '4px 0 0 0' }}>
              {selectedTasks.size} selected for scheduling
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={selectAll}>Select All</button>
            <button className="btn btn-ghost btn-sm" onClick={selectNone}>Select None</button>
          </div>
        </div>

        {Object.entries(groupedTasks).map(([section, items]) => (
          <div key={section} style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: Colors.medGray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {section}
            </p>
            {items.map(({ task, index }) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 4,
                  background: selectedTasks.has(index) ? '#fff' : '#f9f9f7',
                  border: `1px solid ${selectedTasks.has(index) ? Colors.copper : Colors.lightGray}`,
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedTasks.has(index)}
                  onChange={() => toggleTask(index)}
                  style={{ marginTop: 2, accentColor: Colors.copper, cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: Colors.charcoal }}>{task.title}</span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 10,
                      background: `${PRIORITY_COLORS[task.priority]}15`,
                      color: PRIORITY_COLORS[task.priority],
                    }}>
                      {task.priority}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: Colors.medGray, margin: '0 0 4px 0', lineHeight: 1.4 }}>
                    {task.description}
                  </p>
                  <div style={{ display: 'flex', gap: 12, fontSize: 12, color: Colors.medGray, alignItems: 'center', marginTop: 8 }}>
                    <select
                      value={taskTimeframes.get(index) || task.recommended_timeframe}
                      onChange={(e) => {
                        e.stopPropagation();
                        const next = new Map(taskTimeframes);
                        next.set(index, e.target.value);
                        setTaskTimeframes(next);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        fontSize: 12,
                        padding: '4px 8px',
                        borderRadius: 4,
                        border: `1px solid ${Colors.lightGray}`,
                        background: '#fff',
                        cursor: 'pointer',
                        color: Colors.charcoal,
                      }}
                    >
                      {Object.entries(TIMEFRAME_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                    {task.estimated_cost > 0 && <span>~${task.estimated_cost}</span>}
                    <span>{task.category}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = new Set(proRequestTasks);
                        proRequestTasks.has(index) ? next.delete(index) : next.add(index);
                        setProRequestTasks(next);
                      }}
                      style={{
                        marginLeft: 'auto',
                        padding: '4px 10px',
                        borderRadius: 12,
                        border: 'none',
                        fontSize: 11,
                        fontWeight: 600,
                        background: proRequestTasks.has(index) ? Colors.copper : '#f0f0f0',
                        color: proRequestTasks.has(index) ? '#fff' : Colors.medGray,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {proRequestTasks.has(index) ? '✓ Request Pro' : 'Request Pro'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

        {error && (
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: '#E5393520',
            color: '#C62828',
            fontSize: 13,
            marginBottom: 12,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost" onClick={() => { setStep('upload'); setLocalTasks([]); }}>
            Upload Different File
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreateTasks}
            disabled={saving || selectedTasks.size === 0}
          >
            {saving ? 'Creating tasks...' : `Schedule ${selectedTasks.size} Task${selectedTasks.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    );
  }

  // Done step — show success then reset to summary view
  const goToSummary = () => {
    setStep('upload');
    setLocalTasks([]);
    setShowUploadNew(false);
    setError('');
    // Reload existing inspection data
    if (home) {
      supabase
        .from('documents')
        .select('title, created_at, file_url')
        .eq('home_id', home.id)
        .eq('category', 'inspection')
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) {
            setExistingInspection(data[0]);
            if (data[0].file_url) {
              supabase.storage.from('documents').createSignedUrl(data[0].file_url, 3600)
                .then(({ data: urlData }) => { if (urlData?.signedUrl) setReportUrl(urlData.signedUrl); });
            } else {
              setReportUrl(null);
            }
            supabase
              .from('maintenance_tasks')
              .select('id, title, status, priority, category, due_date, estimated_cost, notes')
              .eq('home_id', home.id)
              .like('notes', 'From home inspection:%')
              .order('priority', { ascending: true })
              .then(({ data: taskData }) => { if (taskData) setInspectionTasks(taskData); });
          }
        });
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        background: `${Colors.sage}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px',
        fontSize: 28,
      }}>
        &#10003;
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Tasks Scheduled!</h3>
      <p style={{ fontSize: 14, color: Colors.medGray, marginBottom: 12 }}>
        {selectedTasks.size} maintenance task{selectedTasks.size !== 1 ? 's' : ''} from your home inspection
        {selectedTasks.size !== 1 ? ' have' : ' has'} been added to your calendar
        {proRequestsCreated > 0 && `, and ${proRequestsCreated} pro service request${proRequestsCreated !== 1 ? 's have' : ' has'} been created`}.
      </p>

      {error && (
        <div style={{
          background: '#FEF3CD',
          border: '1px solid #FFC107',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 16,
          fontSize: 13,
          color: '#856404',
          textAlign: 'left',
        }}>
          <strong>Note:</strong> {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={goToSummary}
        >
          View Inspection Summary
        </button>
        {error && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setStep('upload');
              setLocalTasks([]);
              setError('');
              setShowUploadNew(true);
            }}
          >
            Re-upload Report
          </button>
        )}
      </div>
    </div>
  );
}
