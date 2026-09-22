import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebaseClient.js';

const MAX_IMAGE_SIZE = 8 * 1024 * 1024;

const safeFileName = (name = 'evidencia.jpg') => name
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9._-]/g, '-')
  .slice(-100);

export const uploadEvidenceImage = async (file, { uid, monthKey, scope }) => {
  if (!file?.type?.startsWith('image/')) throw new Error('El archivo seleccionado no es una imagen.');
  if (file.size > MAX_IMAGE_SIZE) throw new Error('La imagen supera el máximo de 8 MB.');

  const storagePath = `users/${uid}/${monthKey}/${scope}/${Date.now()}-${safeFileName(file.name)}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return { storagePath, imageUrl: await getDownloadURL(storageRef) };
};

export const deleteEvidenceImage = async (storagePath) => {
  if (!storagePath) return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    if (error.code !== 'storage/object-not-found') throw error;
  }
};

export const getEvidenceImageUrl = (item) => item?.imageUrl || item?.imageBase64 || '';

