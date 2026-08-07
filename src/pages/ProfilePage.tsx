import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../context/AuthContext';
import { updateUserProfile, changePassword } from '../services/authService';
import { uploadToCloudinary } from '../services/storageService';
import { PROVINCES } from '../config/site';
import { FiCamera, FiUser, FiPhone, FiMail, FiShield, FiSave, FiLoader, FiTruck, FiMapPin, FiLock } from 'react-icons/fi';
import toast from 'react-hot-toast';
import './ProfilePage.css';

export default function ProfilePage() {
  const { profile, firebaseUser, refreshProfile } = useAuthContext();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estados para cambiar contraseña
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || firebaseUser?.displayName || '');
      setPhone(profile.phone || '');
      setAvatarUrl(profile.avatarUrl || firebaseUser?.photoURL || '');
      if (profile.shippingAddress) {
        setStreet(profile.shippingAddress.street || '');
        setCity(profile.shippingAddress.city || '');
        setProvince(profile.shippingAddress.province || '');
        setZipCode(profile.shippingAddress.zipCode || '');
      }
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
        shippingAddress: {
          street,
          city,
          province,
          zipCode,
        },
      });
      await refreshProfile();
      toast.success('Perfil y dirección de envío guardados correctamente');
    } catch (err: any) {
      console.error('Error actualizando perfil:', err);
      toast.error(err.message || 'Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    try {
      setChangingPassword(true);
      await changePassword(newPassword);
      toast.success('¡Contraseña actualizada correctamente!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Error al cambiar contraseña:', err);
      const msg = err.code === 'auth/requires-recent-login'
        ? 'Por seguridad, volvvé a iniciar sesión antes de cambiar tu contraseña'
        : err.message || 'Error al cambiar la contraseña';
      toast.error(msg);
    } finally {
      setChangingPassword(false);
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
          <span className={`profile-badge ${profile?.role === 'admin' ? 'profile-badge--admin' : ''}`}>
            <FiShield /> {profile?.role === 'admin' ? 'Administrador' : 'Cliente'}
          </span>
          {uploadingAvatar && <p className="avatar-upload-status">Subiendo imagen a Cloudinary...</p>}
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          <h3 className="profile-section-title">
            <FiUser /> Información Personal
          </h3>

          <div className="form-group">
            <label className="form-label">Nombre completo</label>
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

          <hr className="profile-divider" />

          <h3 className="profile-section-title">
            <FiTruck /> Dirección de Envío Principal
          </h3>
          <p className="profile-section-desc">
            Esta información se usará automáticamente en tus futuras compras.
          </p>

          <div className="form-group">
            <label className="form-label">
              <FiMapPin /> Calle y número (Piso / Dpto)
            </label>
            <input
              className="form-input"
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Ej: Av. Corrientes 1234 4to B"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Localidad / Ciudad</label>
              <input
                className="form-input"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ej: La Plata"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Código Postal (CP)</label>
              <input
                className="form-input"
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="Ej: 1900"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Provincia</label>
            <select
              className="form-select"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            >
              <option value="">Selecciona tu provincia</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="btn btn--primary"
            disabled={saving || uploadingAvatar}
            style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {saving ? <FiLoader className="spinner" /> : <FiSave />}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </form>

        <hr className="profile-divider" style={{ margin: '32px 0' }} />

        <form onSubmit={handleChangePasswordSubmit} className="profile-form">
          <h3 className="profile-section-title">
            <FiLock /> Cambiar Contraseña
          </h3>
          <p className="profile-section-desc">
            Ingresá tu nueva contraseña. Debe tener al menos 6 caracteres.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Nueva contraseña</label>
              <input
                className="form-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••"
                minLength={6}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirmar contraseña</label>
              <input
                className="form-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                minLength={6}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn--outline"
            disabled={changingPassword}
            style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {changingPassword ? <FiLoader className="spinner" /> : <FiLock />}
            {changingPassword ? 'Actualizando...' : 'Actualizar Contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
