import { useRef, useState } from 'react';
import { Image as ImageIcon, Plus, Trash2, Upload, Link as LinkIcon, MonitorPlay } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import { PageHeader, Spinner, Modal, Field, Input, EmptyState } from '../components/shared/ui';

export default function Photos() {
  const { data: photos, loading, refresh } = useAsync(() => api.photos(), []);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setUrl(''); setCaption(''); };

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { alert('Please choose an image under 4 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setUrl(String(reader.result)); // data: URL
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!url.trim()) return;
    setBusy(true);
    try { await api.createPhoto({ url: url.trim(), caption: caption.trim() }); setOpen(false); reset(); await refresh(); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this photo?')) return;
    await api.deletePhoto(id);
    await refresh();
  };

  if (loading && !photos) return <div className="p-6"><Spinner /></div>;
  const list = photos || [];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Photos"
        subtitle="Family photos that slideshow on every screen"
        icon={ImageIcon}
        actions={
          <>
            <Link to="/display" className="btn-secondary"><MonitorPlay size={16} /> Display</Link>
            <button className="btn-primary" onClick={() => { reset(); setOpen(true); }}><Plus size={16} /> Add photo</button>
          </>
        }
      />

      {list.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No photos yet"
          message="Add a few family photos — they'll appear in a calm slideshow on your wall display and dashboards."
          action={<button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Add your first photo</button>} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {list.map(p => (
            <div key={p.id} className="group relative rounded-2xl overflow-hidden border border-gray-100 bg-black aspect-[4/3]">
              <img src={p.url} alt={p.caption} className="w-full h-full object-cover" loading="lazy" />
              {p.caption && <div className="absolute inset-x-0 bottom-0 p-2 text-xs text-white bg-gradient-to-t from-black/70 to-transparent truncate">{p.caption}</div>}
              <button onClick={() => remove(p.id)} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600" aria-label="Remove photo">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} title="Add a photo" onClose={() => setOpen(false)}
        footer={<>
          <button className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy || !url.trim()}>{busy ? 'Saving…' : 'Add photo'}</button>
        </>}>
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={() => fileRef.current?.click()}><Upload size={15} /> Upload from device</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickFile} />
        </div>
        <Field label="…or paste an image URL" hint="A direct link ending in .jpg/.png, or upload above.">
          <div className="flex items-center gap-2">
            <LinkIcon size={16} className="text-gray-400 flex-shrink-0" />
            <Input value={url.startsWith('data:') ? '' : url} placeholder="https://…" onChange={e => setUrl(e.target.value)} />
          </div>
        </Field>
        {url && (
          <div className="rounded-xl overflow-hidden border border-gray-100 bg-black aspect-[4/3]">
            <img src={url} alt="Preview" className="w-full h-full object-cover" />
          </div>
        )}
        <Field label="Caption (optional)">
          <Input value={caption} placeholder="Lake trip last summer" onChange={e => setCaption(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
