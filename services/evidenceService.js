import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebaseClient.js';

const APP_COLLECTION_ID = 'gastos-chile-v2';
const MAX_SOURCE_SIZE = 12 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 420 * 1024;

const evidenceCollection = (uid, monthKey) => collection(
  db,
  'artifacts', APP_COLLECTION_ID,
  'users', uid,
  'monthly_records', monthKey,
  'evidence'
);

const dataUrlSize = (dataUrl) => Math.ceil(((dataUrl.split(',')[1] || '').length * 3) / 4);

const loadImage = (file) => new Promise((resolve, reject) => {
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('No se pudo leer la imagen.'));
  };
  image.src = objectUrl;
});

export const compressEvidenceImage = async (file) => {
  if (!file?.type?.startsWith('image/')) throw new Error('El archivo seleccionado no es una imagen.');
  if (file.size > MAX_SOURCE_SIZE) throw new Error('La imagen supera el máximo permitido de 12 MB.');

  const image = await loadImage(file);
  let scale = Math.min(1, 1400 / Math.max(image.naturalWidth, image.naturalHeight));
  let quality = 0.82;
  let dataUrl = '';

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrlSize(dataUrl) <= TARGET_IMAGE_BYTES) break;
    quality = Math.max(0.5, quality - 0.08);
    scale *= 0.82;
  }

  const sizeBytes = dataUrlSize(dataUrl);
  if (sizeBytes > TARGET_IMAGE_BYTES) {
    throw new Error('No fue posible comprimir la imagen lo suficiente para guardarla.');
  }
  return { imageBase64: dataUrl, sizeBytes };
};

export const saveEvidenceDocument = async ({ uid, monthKey, scope, file }) => {
  const compressed = await compressEvidenceImage(file);
  const evidenceRef = doc(evidenceCollection(uid, monthKey));
  const item = {
    id: evidenceRef.id,
    scope,
    ...compressed,
    originalName: String(file.name || 'evidencia.jpg').slice(0, 120),
    uploadedAt: new Date().toISOString(),
    source: 'firestore'
  };
  await setDoc(evidenceRef, item);
  return item;
};

export const deleteEvidenceDocument = ({ uid, monthKey, id }) => (
  deleteDoc(doc(evidenceCollection(uid, monthKey), id))
);

export const subscribeEvidenceDocuments = ({ uid, monthKey, onChange, onError }) => (
  onSnapshot(evidenceCollection(uid, monthKey), snapshot => {
    const items = snapshot.docs
      .map(item => ({ ...item.data(), id: item.id, source: 'firestore' }))
      .sort((a, b) => String(a.uploadedAt).localeCompare(String(b.uploadedAt)));
    onChange(items);
  }, onError)
);

export const getEvidenceImageUrl = (item) => item?.imageBase64 || item?.imageUrl || '';
