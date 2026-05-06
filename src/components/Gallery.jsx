import { useState, useEffect } from 'react';
import './Gallery.css';

export default function Gallery() {
    const [images, setImages] = useState([]);
    const [selectedImage, setSelectedImage] = useState(null);
    const [loading, setLoading] = useState(false);
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000';

    useEffect(() => {
        fetchGallery();
    }, []);

    const fetchGallery = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/public/gallery`);
            if (!res.ok) throw new Error('Failed to fetch gallery');
            const data = await res.json();
            setImages(data);
        } catch (error) {
            console.error('Gallery error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <section className="gallery-section">
                <div className="gallery-container">
                    <h2>Gallery</h2>
                    <p className="loading-text">Loading gallery...</p>
                </div>
            </section>
        );
    }

    if (images.length === 0) {
        return (
            <section className="gallery-section">
                <div className="gallery-container">
                    <h2>Gallery</h2>
                    <p className="empty-text">Gallery is being updated. Please check back soon!</p>
                </div>
            </section>
        );
    }

    return (
        <section className="gallery-section">
            <div className="gallery-container">
                <div className="gallery-header">
                    <h2>Gallery</h2>
                    <p>Explore the beauty of our PG accommodation</p>
                </div>

                <div className="gallery-grid">
                    {images.map((image) => (
                        <div
                            key={image.id}
                            className="gallery-item"
                            onClick={() => setSelectedImage(image)}
                        >
                            <div className="gallery-item-image">
                                <img src={image.image_src || image.image_url} alt={image.title} loading="lazy" />
                                <div className="gallery-overlay">
                                    <h3>{image.title}</h3>
                                </div>
                            </div>
                            {image.description && (
                                <p className="gallery-item-description">{image.description}</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal */}
            {selectedImage && (
                <div
                    className="gallery-modal"
                    onClick={() => setSelectedImage(null)}
                >
                    <div className="gallery-modal-content" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="gallery-modal-close"
                            onClick={() => setSelectedImage(null)}
                        >
                            ✕
                        </button>
                        <img src={selectedImage.image_src || selectedImage.image_url} alt={selectedImage.title} />
                        <div className="gallery-modal-info">
                            <h3>{selectedImage.title}</h3>
                            {selectedImage.description && (
                                <p>{selectedImage.description}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
