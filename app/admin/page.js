'use client';

import FadeIn from '@/components/FadeIn';
import { createClient } from '@/utils/supabase/client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Trash2, Edit3, Plus, X, Image as ImageIcon } from 'lucide-react';

export default function AdminDashboard() {
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [products, setProducts] = useState([]);
  const [components, setComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const fileInputRef = useRef(null);

  // Dialog Add/Edit
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '', slug: '', category_id: 1, description: '', price: 0, stock_qty: 0, is_active: true, image_urls: ''
  });
  const [selectedComponents, setSelectedComponents] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const checkAdminAndFetch = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/account'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single();

      if (!profile?.is_admin) {
        alert("Accesso negato. Usa un account Dev/Admin.");
        router.push('/account/profilo');
        return;
      }

      setIsAdmin(true);
      fetchProducts();
      fetchComponents();
    };

    checkAdminAndFetch();
  }, [supabase, router]);

  const fetchProducts = async () => {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('id', { ascending: true });
    if (data) setProducts(data);
    setLoading(false);
  };

  const fetchComponents = async () => {
    const { data } = await supabase.from('components').select('*').order('name');
    if (data) setComponents(data);
  };

  // Auto-genera slug dal nome
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[àáâä]/g, 'a').replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i').replace(/[òóôö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const handleNameChange = (name) => {
    const slug = generateSlug(name);
    setFormData({ ...formData, name, slug });
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async () => {
    if (!imageFile) return formData.image_urls;
    setUploading(true);

    const ext = imageFile.name.split('.').pop();
    const fileName = `${formData.slug || 'product'}-${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from('products')
      .upload(fileName, imageFile, { cacheControl: '3600', upsert: false });

    setUploading(false);

    if (error) {
      console.error('Upload error:', error);
      alert('Errore upload immagine: ' + error.message);
      return formData.image_urls;
    }

    // Costruisci URL pubblico
    const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(fileName);
    return publicUrl;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    // 1. Upload immagine (se presente)
    const imageUrl = await uploadImage();

    const productPayload = {
      ...formData,
      image_urls: imageUrl || formData.image_urls,
    };

    let productId;

    if (editingProduct) {
      // Update
      await supabase.from('products').update(productPayload).eq('id', editingProduct.id);
      productId = editingProduct.id;
    } else {
      // Create
      const { data: newProduct } = await supabase.from('products').insert([productPayload]).select('id').single();
      productId = newProduct?.id;
    }

    // 2. Aggiorna product_components
    if (productId) {
      // Cancella associazioni esistenti
      await supabase.from('product_components').delete().eq('product_id', productId);

      // Inserisci nuovi
      if (selectedComponents.length > 0) {
        const rows = selectedComponents.map(cId => ({ product_id: productId, component_id: cId }));
        await supabase.from('product_components').insert(rows);
      }
    }

    // Reset form
    resetForm();
    await fetchProducts();
  };

  const resetForm = () => {
    setEditingProduct(null);
    setFormData({ name: '', slug: '', category_id: 1, description: '', price: 0, stock_qty: 0, is_active: true, image_urls: '' });
    setSelectedComponents([]);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleDelete = async (id) => {
    if (confirm('Sicuro di voler eliminare questo prodotto?')) {
      await supabase.from('products').delete().eq('id', id);
      fetchProducts();
    }
  };

  const handleEdit = async (p) => {
    setEditingProduct(p);
    setFormData({
      name: p.name, slug: p.slug, category_id: p.category_id,
      description: p.description, price: p.price, stock_qty: p.stock_qty, is_active: p.is_active, image_urls: p.image_urls || ''
    });
    setImagePreview(p.image_urls || null);
    setImageFile(null);

    // Carica componenti associati
    const { data: pcs } = await supabase.from('product_components').select('component_id').eq('product_id', p.id);
    setSelectedComponents(pcs ? pcs.map(pc => pc.component_id) : []);
  };

  const toggleComponent = (compId) => {
    setSelectedComponents(prev =>
      prev.includes(compId) ? prev.filter(id => id !== compId) : [...prev, compId]
    );
  };

  if (!isAdmin) return <main className="page-hero text-center"><div className="container" style={{ paddingTop: '120px' }}>Verifica permessi...</div></main>;

  return (
    <main>
      <section className="page-hero text-center" style={{ padding: '80px 0 30px' }}>
        <div className="container">
          <FadeIn>
            <h1 className="hero-title" style={{ fontSize: '2.5rem' }}>Admin Dashboard</h1>
            <p className="hero-subtitle">Gestione Catalogo Prodotti</p>
          </FadeIn>
        </div>
      </section>

      <section className="account-section" style={{ paddingTop: '10px' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>

            {/* Form Aggiungi / Modifica */}
            <div className="account-card" style={{ flex: '1 1 400px', padding: '30px' }}>
              <h3 style={{ marginBottom: '24px' }}>
                {editingProduct ? <><Edit3 size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Modifica Prodotto</> : <><Plus size={20} style={{ verticalAlign: 'middle', marginRight: '8px' }} />Nuovo Prodotto</>}
              </h3>
              <form onSubmit={handleSave} className="account-form">
                {/* Nome → Auto Slug */}
                <div className="form-group">
                  <label>Nome Prodotto *</label>
                  <input type="text" value={formData.name} onChange={e => handleNameChange(e.target.value)} required placeholder="Es: PLANT Pro Max" />
                </div>
                <div className="form-group">
                  <label>Slug (auto-generato)</label>
                  <input type="text" value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} required
                    style={{ fontFamily: 'monospace', fontSize: '0.9rem', color: 'var(--accent-green)' }} />
                </div>

                {/* Categoria e Prezzo */}
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Categoria *</label>
                    <select value={formData.category_id} onChange={e => setFormData({ ...formData, category_id: parseInt(e.target.value) })}
                      style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '1rem', background: 'var(--input-bg)', color: 'var(--text-primary)' }}>
                      <option value={1}>🌱 Vasi</option>
                      <option value={2}>🔧 Accessori</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Prezzo &euro; *</label>
                    <input type="number" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} required />
                  </div>
                </div>

                {/* Stock */}
                <div className="form-group">
                  <label>Quantità in Stock</label>
                  <input type="number" value={formData.stock_qty} onChange={e => setFormData({ ...formData, stock_qty: parseInt(e.target.value) || 0 })} />
                </div>

                {/* Descrizione */}
                <div className="form-group">
                  <label>Descrizione *</label>
                  <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required
                    style={{ width: '100%', padding: '12px 16px', border: '1px solid var(--border-color)', borderRadius: '12px', minHeight: '80px', fontSize: '1rem', fontFamily: 'inherit', background: 'var(--input-bg)', color: 'var(--text-primary)', resize: 'vertical' }} />
                </div>

                {/* Upload Immagine */}
                <div className="form-group">
                  <label>Immagine Prodotto</label>
                  <div style={{
                    border: '2px dashed var(--border-color)', borderRadius: '12px', padding: '20px',
                    textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.3s',
                    background: 'var(--bg-alt)'
                  }}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent-green)'; }}
                    onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; }}
                    onDrop={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--border-color)'; if (e.dataTransfer.files[0]) handleImageSelect({ target: { files: e.dataTransfer.files } }); }}
                  >
                    {imagePreview ? (
                      <div>
                        <img src={imagePreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '160px', borderRadius: '8px', objectFit: 'cover', marginBottom: '10px' }} />
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>Clicca per cambiare immagine</p>
                      </div>
                    ) : (
                      <div>
                        <Upload size={32} style={{ color: '#999', marginBottom: '10px' }} />
                        <p style={{ margin: 0, fontSize: '0.9rem', color: '#666' }}>Clicca o trascina un'immagine</p>
                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#999' }}>PNG, JPG, WebP — Max 5MB</p>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} style={{ display: 'none' }} />
                  </div>
                </div>

                {/* Componenti / Sensori */}
                {components.length > 0 && (
                  <div className="form-group">
                    <label>Componenti e Sensori</label>
                    <div style={{
                      display: 'flex', flexWrap: 'wrap', gap: '8px',
                      padding: '12px', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-alt)'
                    }}>
                      {components.map(comp => (
                        <label key={comp.id} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500',
                          background: selectedComponents.includes(comp.id) ? 'var(--accent-green)' : 'var(--card-bg)',
                          color: selectedComponents.includes(comp.id) ? 'white' : 'var(--text-primary)',
                          border: `1px solid ${selectedComponents.includes(comp.id) ? 'var(--accent-green)' : 'var(--border-color)'}`,
                          transition: 'all 0.2s'
                        }}>
                          <input type="checkbox" checked={selectedComponents.includes(comp.id)}
                            onChange={() => toggleComponent(comp.id)} style={{ display: 'none' }} />
                          {comp.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attivo */}
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--accent-green)' }} />
                    Attivo (Pubblicato)
                  </label>
                </div>

                {/* Bottoni */}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="submit" className="btn btn-primary btn-full" disabled={loading || uploading}>
                    {uploading ? 'Upload immagine...' : loading ? 'Salvataggio...' : 'Salva Prodotto'}
                  </button>
                  {editingProduct && (
                    <button type="button" className="btn btn-secondary" onClick={resetForm}>
                      <X size={16} /> Annulla
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Listato Prodotti */}
            <div className="account-card" style={{ flex: '2 1 500px', padding: '30px' }}>
              <h3 style={{ marginBottom: '20px' }}>Catalogo ({products.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {products.map(p => (
                  <div key={p.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '15px', border: '1px solid var(--border-color)', borderRadius: '12px',
                    gap: '12px', flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      {p.image_urls ? (
                        <img src={p.image_urls} alt={p.name} style={{ width: '50px', height: '50px', borderRadius: '10px', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '50px', height: '50px', borderRadius: '10px', background: 'var(--bg-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ImageIcon size={20} style={{ color: '#999' }} />
                        </div>
                      )}
                      <div>
                        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {p.name}
                          <span style={{
                            fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px',
                            background: p.is_active ? '#dcfce7' : '#fee2e2',
                            color: p.is_active ? '#166534' : '#991b1b'
                          }}>
                            {p.is_active ? 'Online' : 'Nascosto'}
                          </span>
                        </h4>
                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>
                          <span style={{ fontFamily: 'monospace' }}>/{p.slug}</span> · Cat: {p.category_id === 1 ? 'Vaso' : 'Accessorio'} · &euro;{Number(p.price).toFixed(2)} · Stock: {p.stock_qty}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(p)} style={{
                        padding: '6px 14px', border: '1px solid var(--accent-green)', borderRadius: '8px',
                        background: 'transparent', color: 'var(--accent-green)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem'
                      }}>
                        <Edit3 size={14} /> Edit
                      </button>
                      <button onClick={() => handleDelete(p.id)} style={{
                        padding: '6px 14px', border: '1px solid #ef4444', borderRadius: '8px',
                        background: 'transparent', color: '#ef4444', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem'
                      }}>
                        <Trash2 size={14} /> Del
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>
    </main>
  );
}
