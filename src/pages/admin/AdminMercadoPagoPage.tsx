import { useState, useEffect } from 'react';
import { getMPSettings, saveMPSettings, type MPSettings, DEFAULT_MP_SETTINGS } from '../../services/mpService';
import { FiCreditCard, FiSave, FiCheckCircle, FiAlertCircle, FiInfo, FiKey, FiHelpCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminMercadoPagoPage() {
  const [settings, setSettings] = useState<MPSettings>(DEFAULT_MP_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getMPSettings();
      setSettings(data);
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveMPSettings(settings);
      toast.success('Credenciales y configuración de Mercado Pago guardadas correctamente');
    } catch (err: any) {
      console.error(err);
      toast.error('Error al guardar credenciales de Mercado Pago');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  const hasCredentials = !!(settings.accessToken && settings.publicKey);

  return (
    <div className="admin-mp-page">
      <div className="admin-header">
        <div>
          <h1>Configuración de Mercado Pago</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Administrá las credenciales de API para procesar pagos con Tarjeta de Crédito, Débito y Mercado Pago.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', background: !hasCredentials ? '#fef9e7' : settings.isSandbox ? '#ebf5fb' : '#e8f8f5', borderRadius: 20, border: `1px solid ${!hasCredentials ? '#f9e79f' : settings.isSandbox ? '#a9cce3' : '#a3e4d7'}`, fontSize: 'var(--text-xs)' }}>
          {!hasCredentials ? (
            <>
              <FiAlertCircle style={{ color: '#f39c12' }} />
              <strong style={{ color: '#b7950b' }}>Faltan Credenciales</strong>
            </>
          ) : settings.isSandbox ? (
            <>
              <FiInfo style={{ color: '#2980b9' }} />
              <strong style={{ color: '#1f618d' }}>Modo Pruebas / Sandbox</strong>
            </>
          ) : (
            <>
              <FiCheckCircle style={{ color: '#27ae60' }} />
              <strong style={{ color: '#196f3d' }}>Producción En Vivo</strong>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Formulario de Credenciales */}
        <div className="admin-card" style={{ background: 'var(--color-bg)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <h3 style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-lg)' }}>
            <FiKey style={{ color: 'var(--color-primary)' }} /> Credenciales de Integración
          </h3>

          <form onSubmit={handleSave}>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={!settings.isSandbox}
                  onChange={(e) => setSettings({ ...settings, isSandbox: !e.target.checked })}
                  style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
                />
                Activar Modo Producción (Pagos reales)
              </label>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginTop: 4 }}>
                Desmarcado = Modo Sandbox de prueba. Marcado = Cobros reales con tu cuenta de Mercado Pago.
              </span>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Public Key (Clave Pública)</label>
              <input
                className="form-input"
                value={settings.publicKey}
                onChange={(e) => setSettings({ ...settings, publicKey: e.target.value.trim() })}
                placeholder="Ej: APP_USR-xxxx... o TEST-xxxx..."
                required
              />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Empieza con APP_USR- (producción) o TEST- (pruebas).</span>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Access Token (Token de Acceso)</label>
              <input
                type="password"
                className="form-input"
                value={settings.accessToken}
                onChange={(e) => setSettings({ ...settings, accessToken: e.target.value.trim() })}
                placeholder="Ej: APP_USR-xxxx... o TEST-xxxx..."
                required
              />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Clave privada para autorizar las transacciones.</span>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Máximo de Cuotas Permitidas</label>
              <select
                className="form-select"
                value={settings.maxInstallments}
                onChange={(e) => setSettings({ ...settings, maxInstallments: Number(e.target.value) })}
              >
                <option value={1}>1 Cuota (Sin financiación)</option>
                <option value={3}>Hasta 3 Cuotas</option>
                <option value={6}>Hasta 6 Cuotas</option>
                <option value={12}>Hasta 12 Cuotas</option>
              </select>
            </div>

            <button type="submit" className="btn btn--primary btn--full" disabled={saving}>
              <FiSave /> {saving ? 'Guardando...' : 'Guardar Credenciales de Mercado Pago'}
            </button>
          </form>
        </div>

        {/* Guía rápida de obtención */}
        <div className="admin-card" style={{ background: 'var(--color-bg-alt)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-md)', color: 'var(--color-primary)' }}>
            <FiHelpCircle /> ¿Cómo obtener estas credenciales?
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Compartile estos sencillos pasos al cliente para que los genere desde su cuenta de Mercado Pago:
          </p>

          <ol style={{ paddingLeft: 20, fontSize: 'var(--text-xs)', display: 'flex', flexDirection: 'column', gap: 10, lineHeight: 1.5, color: 'var(--color-text)' }}>
            <li>
              Ingresar a <strong>mercadopago.com.ar/developers</strong> e iniciar sesión con la cuenta de la tienda.
            </li>
            <li>
              Ir al menú superior <strong>"Tus integraciones"</strong> y hacer clic en <strong>"Crear aplicación"</strong>.
            </li>
            <li>
              Seleccionar el tipo <strong>"Checkout Pro"</strong> y nombrar la app <i>"Tienda ESI"</i>.
            </li>
            <li>
              En el menú lateral, ingresar a <strong>"Credenciales de producción"</strong>.
            </li>
            <li>
              Copiar el <strong>Public Key</strong> y el <strong>Access Token</strong> y cargarlos en este formulario.
            </li>
          </ol>

          <div style={{ marginTop: 20, padding: 12, background: 'var(--color-bg)', borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 'var(--text-xs)' }}>
            💡 <strong>Tip:</strong> Podés verificar si las credenciales son de producción observando si comienzan con <code>APP_USR-</code>.
          </div>
        </div>
      </div>
    </div>
  );
}
