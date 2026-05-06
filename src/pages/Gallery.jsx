import GalleryComponent from '../components/Gallery';
import './Gallery.css';

export default function Gallery() {
    // BUG FIX: Removed legacyBlocks array — it was defined but never used (dead code)
    return (
        <>
            {/* Database-driven Gallery */}
            <GalleryComponent />
        </>
    );
}