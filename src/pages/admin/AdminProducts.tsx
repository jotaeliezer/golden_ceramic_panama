import { useEffect, useState, type FormEvent } from "react";
import { Product } from "../../types";
import { Plus, Edit2, Trash2 } from "lucide-react";

const labelClass = "block text-sm font-medium text-gray-700 dark:text-neutral-200";
const fieldClass =
  "mt-1 w-full rounded border border-gray-300 bg-white p-2 text-gray-900 dark:border-neutral-600 dark:bg-neutral-950 dark:text-neutral-100";
const hintClass = "mt-1 text-xs text-gray-500 dark:text-neutral-400";
const optionalClass = "font-normal text-gray-400 dark:text-neutral-400";

function stockBadgeClass(stock: number) {
  if (stock > 10) return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200";
  if (stock > 0) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-100";
  return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  
  const emptyForm = {
    name: "",
    description: "",
    name_en: "",
    description_en: "",
    price: "",
    imageUrl: "",
    category: "",
    stock: "",
  };

  const [formData, setFormData] = useState(emptyForm);

  const fetchProducts = () => {
    fetch('/api/products')
      .then(r => r.json())
      .then(setProducts)
      .catch(console.error);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const isUpdate = !!currentId;
    const url = isUpdate ? `/api/products/${currentId}` : '/api/products';
    const method = isUpdate ? "PUT" : "POST";

    await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
      },
      body: JSON.stringify(formData)
    });

    setIsEditing(false);
    fetchProducts();
  };

  const handleEdit = (p: Product) => {
    setCurrentId(p.id);
    setFormData({
      name: p.name,
      description: p.description ?? "",
      name_en: p.name_en ?? "",
      description_en: p.description_en ?? "",
      price: p.price.toString(),
      imageUrl: p.imageUrl,
      category: p.category,
      stock: p.stock.toString()
    });
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    await fetch(`/api/products/${id}`, {
      method: "DELETE",
      headers: { 'Authorization': `Bearer ${localStorage.getItem('adminToken')}` }
    });
    fetchProducts();
  };

  const startNew = () => {
    setCurrentId(null);
    setFormData(emptyForm);
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <div className="max-w-2xl bg-white p-8 shadow rounded dark:bg-neutral-900 dark:text-neutral-100 dark:ring-1 dark:ring-white/10">
        <h2 className="text-2xl font-serif mb-6">{currentId ? "Edit Product" : "New Product"}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Name</label>
            <input required type="text" className={fieldClass} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          </div>
          <div>
            <label className={labelClass}>English name <span className={optionalClass}>(optional)</span></label>
            <input type="text" className={fieldClass} value={formData.name_en} onChange={e => setFormData({...formData, name_en: e.target.value})} />
            <p className={hintClass}>Shown when the shop language is English. Leave blank to keep the Spanish name.</p>
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <input required type="text" className={fieldClass} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Price ($)</label>
              <input required type="number" step="0.01" className={fieldClass} value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
            </div>
            <div>
              <label className={labelClass}>Stock</label>
              <input required type="number" className={fieldClass} value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Product Image</label>
            <input 
              type="file" 
              accept="image/*"
              className={fieldClass}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setFormData({...formData, imageUrl: reader.result as string});
                  };
                  reader.readAsDataURL(file);
                }
              }} 
            />
            {formData.imageUrl && <img src={formData.imageUrl} className="h-20 mt-2 object-cover" alt="Preview"/>}
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea required rows={4} className={fieldClass} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
          <div>
            <label className={labelClass}>English description <span className={optionalClass}>(optional)</span></label>
            <textarea rows={4} className={fieldClass} value={formData.description_en} onChange={e => setFormData({...formData, description_en: e.target.value})} />
            <p className={hintClass}>Shown when the shop language is English. Leave blank to keep the Spanish description.</p>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={() => setIsEditing(false)} className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800">Cancel</button>
            <button type="submit" className="rounded bg-ink px-4 py-2 text-white hover:bg-ink-light dark:ring-1 dark:ring-white/40">Save Product</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
        <h1 className="text-3xl font-serif text-charcoal">Products</h1>
        <button onClick={startNew} className="flex items-center rounded bg-ink px-4 py-2 text-sm font-semibold tracking-widest text-white hover:bg-ink-light dark:ring-1 dark:ring-white/40">
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </button>
      </div>

      <div className="md:hidden space-y-3">
        {products.map(p => (
          <article key={p.id} className="bg-white shadow rounded-lg p-4 dark:bg-neutral-900 dark:ring-1 dark:ring-white/10">
            <div className="flex items-start gap-3 min-w-0">
              <img className="h-12 w-12 rounded-full object-cover shrink-0" src={p.imageUrl} alt="" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 break-words dark:text-neutral-100">{p.name}</div>
                <div className="text-sm text-gray-500 break-words dark:text-neutral-300">{p.category}</div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-900 dark:text-neutral-100">${p.price.toFixed(2)}</span>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${stockBadgeClass(p.stock)}`}>
                    {p.stock} in stock
                  </span>
                </div>
                <div className="mt-3 flex gap-4 text-sm font-medium">
                  <button onClick={() => handleEdit(p)} className="min-h-11 text-gold-dark hover:text-gold">
                    <Edit2 className="w-4 h-4 inline" /> Edit
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="min-h-11 text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4 inline" /> Delete
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden md:block bg-white shadow overflow-x-auto sm:rounded-lg dark:bg-neutral-900 dark:ring-1 dark:ring-white/10">
          <table className="w-full divide-y divide-gray-200 dark:divide-neutral-700">
            <thead className="bg-gray-50 dark:bg-neutral-950">
              <tr>
                <th className="px-3 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-neutral-300">Product</th>
                <th className="px-3 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-neutral-300">Price</th>
                <th className="px-3 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-neutral-300">Stock</th>
                <th className="px-3 py-3 sm:px-6 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-neutral-300">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200 dark:bg-neutral-900 dark:divide-neutral-700">
              {products.map(p => (
                <tr key={p.id}>
                  <td className="px-3 py-4 sm:px-6 align-top">
                    <div className="flex items-center min-w-0">
                      <div className="h-10 w-10 flex-shrink-0">
                        <img className="h-10 w-10 rounded-full object-cover" src={p.imageUrl} alt="" />
                      </div>
                      <div className="ml-4 min-w-0">
                        <div className="text-sm font-medium text-gray-900 break-words dark:text-neutral-100">{p.name}</div>
                        <div className="text-sm text-gray-500 break-words dark:text-neutral-300">{p.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 sm:px-6 text-sm text-gray-900 align-top dark:text-neutral-100">${p.price.toFixed(2)}</td>
                  <td className="px-3 py-4 sm:px-6 align-top">
          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${stockBadgeClass(p.stock)}`}>
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-3 py-4 sm:px-6 text-right text-sm font-medium align-top">
                    <div className="flex flex-wrap justify-end gap-x-4 gap-y-2">
                      <button onClick={() => handleEdit(p)} className="text-gold-dark hover:text-gold">
                        <Edit2 className="w-4 h-4 inline" /> Edit
                      </button>
                      <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4 inline" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      </div>
    </div>
  );
}
