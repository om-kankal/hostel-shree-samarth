import { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Eye, EyeOff, MoveUp, MoveDown } from 'lucide-react';
import { useToast } from './ToastContext';
import { adminHeaders } from '../utils/api';
import './GalleryManagement.css';

export default function GalleryManagement() {
    const { addToast } = useToast();
    const [images, setImages] = useState([]);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        image_url: '',
        image_base64: '',
        display_order: 0,
    });
    const [editingId, setEditingId] = useState(null);
    const [_loading, setLoading] = useState(false);
    const [_selectedFileName, setSelectedFileName] = useState('');
    const fileInputRef = useRef(null);
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000';

    useEffect(() => {
        fetchGallery();
    }, []);

    const fetchGallery = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/admin/gallery`, { headers: adminHeaders() });
            if (!res.ok) throw new Error('Failed to fetch gallery');
            const data = await res.json();
            setImages(data);
        } catch (error) {
            addToast(`Error loading gallery: ${error.message}`, 'error');
        }
    };

    const SUPPORTED_TYPES = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        'image/webp', 'image/bmp', 'image/avif'
    ];
    const MAX_FILE_SIZE_MB = 5;

    const _handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reject HEIC/HEIF — browsers cannot render them natively
        if (file.type === 'image/heic' || file.type === 'image/heif' ||
            file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
            addToast('HEIC/HEIF format is not supported by browsers. Please convert to JPG or PNG first.', 'error');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // Reject unsupported types
        if (!SUPPORTED_TYPES.includes(file.type)) {
            addToast(`Unsupported format: ${file.type || 'unknown'}. Use JPG, PNG, WEBP, GIF, BMP, or AVIF.`, 'error');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        // Reject files over size limit
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            addToast(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`, 'error');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            setFormData(prev => ({
                ...prev,
                image_base64: event.target.result,
                image_url: '', // Clear URL when a file is chosen to avoid sending both
            }));
            setSelectedFileName(`${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
            addToast(`Image selected: ${file.name}`, 'success');
        };
        reader.onerror = () => {
            addToast('Failed to read the file. Please try again.', 'error');
        };
        reader.readAsDataURL(file);
    };

    const _handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            // BUG FIX 4: parseInt('') returns NaN — fall back to 0 to prevent server errors
            [name]: name === 'display_order' ? (parseInt(value) || 0) : value
        }));
    };

    const resetForm = () => {
        setFormData({ title: '', description: '', image_url: '', image_base64: '', display_order: 0 });
        setEditingId(null);
        setSelectedFileName('');
        // BUG FIX 2 (part of): Use ref to properly clear the file input element
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const _handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title || (!formData.image_url && !formData.image_base64)) {
            addToast('Title and either image URL or file upload are required', 'error');
            return;
        }

        setLoading(true);
        try {
            const url = editingId ? `${API_BASE}/api/admin/gallery/${editingId}` : `${API_BASE}/api/admin/gallery`;
            const method = editingId ? 'PUT' : 'POST';

            // BUG FIX 1: Send only one image source — prefer base64 upload over URL, never send both
            const payload = {
                title: formData.title,
                description: formData.description,
                display_order: formData.display_order,
                ...(formData.image_base64
                    ? { image_base64: formData.image_base64, image_url: '' }
                    : { image_url: formData.image_url.trim(), image_base64: null }
                ),
            };

            const res = await fetch(url, {
                method,
                headers: adminHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                throw new Error(errorData?.message || 'Failed to save gallery image');
            }

            addToast(editingId ? 'Gallery image updated' : 'Gallery image added', 'success');
            resetForm();
            fetchGallery();
        } catch (error) {
            addToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this image?')) return;

        try {
            const res = await fetch(`${API_BASE}/api/admin/gallery/${id}`, { method: 'DELETE', headers: adminHeaders() });
            if (!res.ok) throw new Error('Failed to delete');
            addToast('Gallery image deleted', 'success');
            fetchGallery();
        } catch (error) {
            addToast(`Error: ${error.message}`, 'error');
        }
    };

    const handleToggleVisibility = async (id, currentVis) => {
        try {
            const res = await fetch(`${API_BASE}/api/admin/gallery/${id}`, {
                method: 'PUT',
                headers: adminHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ is_visible: !currentVis })
            });
            if (!res.ok) throw new Error('Failed to update visibility');
            addToast(currentVis ? 'Image hidden' : 'Image shown', 'success');
            fetchGallery();
        } catch (error) {
            addToast(`Error: ${error.message}`, 'error');
        }
    };

    const handleReorder = async (id, direction) => {
        const img = images.find(i => i.id === id);
        if (!img) return;

        let newOrder = img.display_order + (direction === 'up' ? -1 : 1);
        newOrder = Math.max(0, newOrder);

        try {
            const res = await fetch(`${API_BASE}/api/admin/gallery/${id}`, {
                method: 'PUT',
                headers: adminHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ display_order: newOrder })
            });
            if (!res.ok) throw new Error('Failed to reorder');
            addToast('Gallery reordered', 'success');
            fetchGallery();
        } catch (error) {
            addToast(`Error: ${error.message}`, 'error');
        }
    };

    // Returns the correct src for an image — prefers base64 upload over URL
    // This fixes PNG and all uploaded formats not showing in the gallery card preview
    const getImageSrc = (image) => {
        if (image.image_base64) return image.image_base64;
        if (image.image_url) return image.image_url;
        return '';
    };

    return (
        <div className="gallery-management">
            <div className="gallery-section-header">
                <h2>🖼️ Gallery Management</h2>
                <p>Manage gallery images that appear on the public website</p>
            </div>

            <div className="gallery-form-section">
                <h3>{editingId ? 'Edit Gallery Image' : 'Upload Gallery Image'}</h3>
                <form className="gallery-form" onSubmit={_handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="gallery-title">Title</label>
                        <input
                            id="gallery-title"
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={_handleInputChange}
                            placeholder="Enter image title"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="gallery-description">Description</label>
                        <textarea
                            id="gallery-description"
                            name="description"
                            value={formData.description}
                            onChange={_handleInputChange}
                            placeholder="Enter image description"
                            rows="3"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="gallery-order">Display Order</label>
                        <input
                            id="gallery-order"
                            type="number"
                            name="display_order"
                            value={formData.display_order}
                            onChange={_handleInputChange}
                            min="0"
                        />
                    </div>

                    <div className="form-group">
                        <label>Image Upload</label>
                        <div className="file-upload">
                            <label className="file-upload-label" htmlFor="gallery-image-upload">
                                <Upload size={18} />
                                Upload Image
                            </label>
                            <input
                                id="gallery-image-upload"
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/bmp,image/avif"
                                onChange={_handleFileChange}
                            />
                            {_selectedFileName && <span className="file-name">{_selectedFileName}</span>}
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="btn-primary" disabled={_loading}>
                            {_loading ? 'Saving...' : editingId ? 'Update Image' : 'Add Image'}
                        </button>
                        {editingId && (
                            <button type="button" className="btn-secondary" onClick={resetForm}>
                                Cancel
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* Gallery List */}
            <div className="gallery-list-section">
                <h3>Gallery Images ({images.length})</h3>
                {images.length === 0 ? (
                    <p className="empty-state">No images yet. Add your first gallery image above!</p>
                ) : (
                    <div className="gallery-grid">
                        {images.map((image) => (
                            <div key={image.id} className="gallery-card">
                                <div className="gallery-card-image">
                                <img src={getImageSrc(image)} alt={image.title} />
                                    <div className="image-overlay">
                                        <span className={`visibility-badge ${image.is_visible ? 'visible' : 'hidden'}`}>
                                            {image.is_visible ? 'Public' : 'Hidden'}
                                        </span>
                                    </div>
                                </div>
                                <div className="gallery-card-content">
                                    <h4>{image.title}</h4>
                                    {image.description && <p>{image.description}</p>}
                                    <p className="order-info">Order: {image.display_order}</p>
                                </div>
                                <div className="gallery-card-actions">
                                    <button
                                        onClick={() => handleToggleVisibility(image.id, image.is_visible)}
                                        title={image.is_visible ? 'Hide' : 'Show'}
                                        className="btn-icon"
                                    >
                                        {image.is_visible ? <Eye size={18} /> : <EyeOff size={18} />}
                                        <span className="btn-text">{image.is_visible ? 'Show' : 'Hide'}</span>
                                    </button>
                                    <button
                                        onClick={() => handleReorder(image.id, 'up')}
                                        title="Move up"
                                        className="btn-icon"
                                    >
                                        <MoveUp size={18} />
                                        <span className="btn-text">↑</span>
                                    </button>
                                    <button
                                        onClick={() => handleReorder(image.id, 'down')}
                                        title="Move down"
                                        className="btn-icon"
                                    >
                                        <MoveDown size={18} />
                                        <span className="btn-text">↓</span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(image.id)}
                                        className="btn-icon delete"
                                        title="Delete image"
                                    >
                                        <Trash2 size={18} />
                                        <span className="btn-text">Delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
