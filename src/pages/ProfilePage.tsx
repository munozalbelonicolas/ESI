import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { updateUserProfile } from '../services/authService';
import { uploadToCloudinary } from '../services/storageService';
import { FiCamera, FiUser, FiPhone, FiMail, FiShield, FiSave, FiLoader } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './ProfilePage.css';

export default function ProfilePage() {
  const { profile, firebaseUser, refreshProfile } = useAuthContext();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || firebaseUser?.displayName || '');
      setPhone(profile.phone || '');
      setAvatarUrl(profile.avatarUrl || firebaseUser?.photoURL || '');
    } else if (firebaseUser) {
      setDisplayName(firebaseUser.displayName || '');
      setAvatarUrl(firebaseUser.photoURL || '');
    }
  }, [profile, firebaseUser]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor seleccioná un archivo de imagen válido.');
      return;
    }

    try {
      setUploadingAvatar(true);
      toast.loading('Subiendo foto de avatar...', { id: 'avatar-upload' });
      
      // Subir avatar a Cloudinary en la carpeta products o avatars
      const url = await uploadToCloudinary(file, 'products');
      setAvatarUrl(url);

      if (firebaseUser) {
        await updateUserProfile(firebaseUser.uid, { avatarUrl: url });
        await refreshProfile();
      }

      toast.success('¡Foto de avatar actualizada!', { id: 'avatar-upload' });
    } catch (err: any) {
      console.error('Error al subir avatar:', err);
      toast.error(err.message || 'Error al subir la imagen del avatar', { id: 'avatar-upload' });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;

    try {
      setSaving(true);
      await updateUserProfile(firebaseUser.uid, {
        displayName,
        phone,
        avatarUrl,
      });
      await refreshProfile();
      toast.success('Perfil actualizado correctamente');
    } catch (err: any) {
      console.error('Error actualizando perfil:', err);
      toast.error(err.message || 'Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const initialLetter = (displayName || firebaseUser?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="section container">
      <div className="profile-page">
        <div className="profile-header">
          <div className="profile-avatar-wrapper">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="profile-avatar" />
            ) : (
              <div className="profile-avatar">{initialLetter}</div>
            )}
            <label htmlFor="avatar-file-input" className="profile-avatar-badge" title="Cambiar foto de perfil">
              {uploadingAvatar ? <FiLoader className="spinner" /> : <FiCamera />}
            </label>
            <input
              id="avatar-file-input"
              type="file"
              accept="image/*"
              className="profile-avatar-input"
              onChange={handleAvatarChange}
              disabled={uploadingAvatar}
            />
          </div>
          <h2>{displayName || 'Mi Perfil'}</h2>
          <span className={`profile-badge ${profile?.role === 'admin' ? 'admin' : ''}`}>
            <FiShield /> {profile?.role === 'admin' ? 'Administrador' : 'Cliente'}
          </span>
          {uploadingAvatar && <p className="avatar-upload-status">Subiendo imagen a Cloudinary...</p>}
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-group">
            <label className="form-label">
              <FiUser /> Nombre completo
            </label>
            <input
              className="form-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tu nombre y apellido"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <FiMail /> Correo electrónico
            </label>
            <input
              className="form-input"
              type="email"
              value={firebaseUser?.email || ''}
              disabled
              style={{ opacity: 0.7, cursor: 'not-allowed', backgroundColor: 'var(--color-gray-100, #f3f4f6)' }}
            />
            <small style={{ color: 'var(--color-text-light)', fontSize: '0.8rem', marginTop: '4px' }}>
              El correo electrónico no se puede modificar desde aquí.
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">
              <FiPhone /> Teléfono / WhatsApp
            </label>
            <input
              className="form-input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: 1112345678"
            />
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={saving || uploadingAvatar}
            style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {saving ? <FiLoader className="spinner" /> : <FiSave />}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>
      </div>
    </div>
  );
}
