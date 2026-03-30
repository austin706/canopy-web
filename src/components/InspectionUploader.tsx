import { useState, useRef } from 'react';
import { useStore } from '@/store/useStore';
import { parseHomeInspection, type InspectionTask } from '@/services/ai';
import { supabase } from '@/services/supabase';
import { Colors } from '@/constants/theme';

const MAX_FILE_SIZE_MB = 100;
const PDF_JS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs';
const PDF_JS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs';

/** Dynamically load pdf.js from CDN (cached after first load) */
let pdfjsLib: any = null;
async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import(/* @vite-ignore */ PDF_JS_CDN);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_CDN;
  return pdfjsLib;
}

/** Extract text from all pages of a PDF using pdf.js */
async function extractPdfText(file: File, onProgress?: (page: number, total: number) => void): Promise<{ text: string; pageCount: number }> {
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
      if (text) pageTexts.push(`--- Page ${i} ---\n${text}`);
    } catch {
      // Skip unreadable pages
    }
  }

  return { text: pageTexts.join('\n\n'), pageCount };
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
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // File size check
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }

    setFileName(file.name);
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
          // Text-based PDF — send extracted text (cap at ~80k chars for API limits)
          const trimmed = text.length > 80000 ? text.substring(0, 80000) + '\n\n[Report truncated]' : text;
          documentText = `Home Inspection Report (${file.name}, ${pageCount} pages):\n\n${trimmed}`;
          setProgress('Analyzing report with AI...');
        } else {
          // Scanned/image-based PDF — render ALL pages and process in batches via Vision AI
          setProgress('PDF is image-based, rendering all pages for AI vision analysis...');

          // Render every page (skip cover pages 1-2 which are usually branding, not findings)
          const allPages: number[] = [];
          for (let i = 1; i <= pageCount; i++) allPages.push(i);

          // Render at 1.0x scale with moderate compression to keep payload manageable
          const allImages = await renderPdfPagesToImages(file, allPages, 1.0, (page, total) => {
            setProgress(`Rendering page ${page} of ${total}...`);
          });

          if (allImages.length === 0) {
            throw new Error('Could not read any pages from this PDF. The file may be corrupted or password-protected.');
          }

          // Process in batches — each batch sends one stitched image to the AI
          // Stitch ~8 pages into a vertical strip per batch for a single API call
          const PAGES_PER_BATCH = 8;
          const batches: string[][] = [];
          for (let i = 0; i < allImages.length; i += PAGES_PER_BATCH) {
            batches.push(allImages.slice(i, i + PAGES_PER_BATCH));
          }

          const allTasks: InspectionTask[] = [];
          for (let b = 0; b < batches.length; b++) {
            const batch = batches[b];
            const startPage = b * PAGES_PER_BATCH + 1;
            const endPage = Math.min(startPage + batch.length - 1, pageCount);
            setProgress(`Analyzing pages ${startPage}–${endPage} of ${pageCount} (batch ${b + 1}/${batches.length})...`);

            // Stitch batch pages into a single tall image
            const stitchedBase64 = await stitchImagesVertically(batch);

            const context = `Home Inspection Report (${file.name}), pages ${startPage}–${endPage} of ${pageCount}. ` +
              `Extract ALL maintenance findings, defects, safety concerns, and recommendations visible on these pages. ` +
              `Include the inspection section name (e.g., HVAC, Plumbing, Roof, Electrical) for each finding.`;

            try {
              const batchResult = await parseHomeInspection(context, stitchedBase64);
              allTasks.push(...batchResult);
            } catch (err: any) {
              console.warn(`Batch ${b + 1} failed:`, err.message);
              // Continue with other batches — don't fail the whole report
            }
          }

          if (allTasks.length === 0) {
            throw new Error('AI could not extract any maintenance tasks from this report. The pages may contain only photos or non-inspection content.');
          }

          // Deduplicate tasks by title similarity
          const seen = new Set<string>();
          const dedupedTasks = allTasks.filter(task => {
            const key = task.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (seen.has(key)) return false;
            seen.add(key);
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
          frequency: 'once' as const,
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
          const highestPriority = items.reduce((max, { task }) => {
            const priorityOrder = { urgent: 3, high: 2, medium: 1, low: 0 };
            return priorityOrder[task.priority as keyof typeof priorityOrder] > priorityOrder[max.priority as keyof typeof priorityOrder] ? task : max;
          });

          const urgency = ['urgent', 'high'].includes(highestPriority.priority) ? 'urgent' : 'routine';
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
                  pro_request_id: request.id,
                  maintenance_task_id: createdTask.id,
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
              <div style={{ fontSize: 32, marginBottom: 12 }}>&#128270;</div>
              <p style={{ fontSize: 16, fontWeight: 600, color: Colors.charcoal }}>
                Analyzing inspection report...
              </p>
              <p style={{ fontSize: 13, color: Colors.medGray, marginTop: 4 }}>
                {fileName}
              </p>
              <p style={{ fontSize: 13, color: Colors.copper, fontWeight: 500 }}>
                {progress || 'AI is reading and extracting maintenance items. This may take a moment.'}
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

  // Done step
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
      <p style={{ fontSize: 14, color: Colors.medGray, marginBottom: 24 }}>
        {selectedTasks.size} maintenance task{selectedTasks.size !== 1 ? 's' : ''} from your home inspection
        {selectedTasks.size !== 1 ? ' have' : ' has'} been added to your calendar
        {proRequestsCreated > 0 && `, and ${proRequestsCreated} pro service request${proRequestsCreated !== 1 ? 's have' : ' has'} been created`}.
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <button className="btn btn-ghost" onClick={() => { setStep('upload'); setLocalTasks([]); setSelectedTasks(new Set()); setTaskTimeframes(new Map()); setProRequestTasks(new Set()); setProRequestsCreated(0); }}>
          Upload Another
        </button>
      </div>
    </div>
  );
}
