import { useState, useEffect } from 'react';
import {
  getShippingSettings,
  saveShippingSettings,
  getShippingQuotes,
  type ShippingSettings,
  type ShippingQuote,
} from '../../services/shippingService';
import { formatPrice } from '../../utils/formatPrice';
import { FiTruck, FiSave, FiTrendingUp, FiCheckCircle, FiSearch, FiRefreshCw } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function AdminShippingPage() {
  const [settings, setSettings] = useState<ShippingSettings>({
    localRate: 3800,
    regionalRate: 5200,
    nacional1Rate: 6000,
    nacional2Rate: 7800,
    freeShippingMin: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [percentageInput, setPercentageInput] = useState<number>(10);

  // Tester state
  const [testZip, setTestZip] = useState('1425');
  const [testWeight, setTestWeight] = useState(500);
  const [testQuotes, setTestQuotes] = useState<ShippingQuote[]>([]);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getShippingSettings();
      setSettings(data);
      setLoading(false);
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveShippingSettings(settings);
      toast.success('Tarifas de Correo Argentino guardadas correctamente');
    } catch (err: any) {
      console.error(err);
      toast.error('Error al guardar tarifas');
    } finally {
      setSaving(false);
    }
  };

  const applyPercentageAdjustment = (percent: number) => {
    const factor = 1 + percent / 100;
    setSettings((prev) => ({
      ...prev,
      localRate: Math.round(prev.localRate * factor),
      regionalRate: Math.round(prev.regionalRate * factor),
      nacional1Rate: Math.round(prev.nacional1Rate * factor),
      nacional2Rate: Math.round(prev.nacional2Rate * factor),
    }));
    toast.success(`Ajuste de ${percent > 0 ? '+' : ''}${percent}% aplicado a la vista previa. Guardá los cambios para confirmar.`);
  };

  const handleTestCalculations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (testZip.length !== 4) {
      toast.error('Ingresá un código postal válido (4 dígitos)');
      return;
    }
    setTesting(true);
    try {
      const res = await getShippingQuotes(testZip, testWeight);
      setTestQuotes(res);
    } catch {
      toast.error('Error al probar cotización');
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="admin-shipping-page">
      <div className="admin-header">
        <div>
          <h1>Gestor de Tarifas — Correo Argentino</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Administrá los precios base de envíos por zonas geográficas y aplicá aumentos masivos con un clic.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
        {/* Formulario Principal de Tarifas */}
        <div className="admin-card" style={{ background: 'var(--color-bg)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-lg)' }}>
            <FiTruck style={{ color: 'var(--color-primary)' }} /> Tarifas Base por Zona (Paquete 500g)
          </h3>

          <form onSubmit={handleSave}>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                1. Local / AMBA (CABA y Gran Buenos Aires)
              </label>
              <input
                type="number"
                className="form-input"
                value={settings.localRate}
                onChange={(e) => setSettings({ ...settings, localRate: Number(e.target.value) })}
                min={0}
                required
              />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>CPs 1000 al 1899</span>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                2. Regional (Prov. Buenos Aires, Córdoba, Santa Fe)
              </label>
              <input
                type="number"
                className="form-input"
                value={settings.regionalRate}
                onChange={(e) => setSettings({ ...settings, regionalRate: Number(e.target.value) })}
                min={0}
                required
              />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>CPs 1900 al 3100 / 5000 al 7999</span>
            </div>

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                3. Nacional 1 (NOA, NEA, Cuyo)
              </label>
              <input
                type="number"
                className="form-input"
                value={settings.nacional1Rate}
                onChange={(e) => setSettings({ ...settings, nacional1Rate: Number(e.target.value) })}
                min={0}
                required
              />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>CPs 3100 al 4999 (Tucumán, Mendoza, Salta, etc.)</span>
            </div>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>
                4. Nacional 2 (Patagonia y Extremo Sur)
              </label>
              <input
                type="number"
                className="form-input"
                value={settings.nacional2Rate}
                onChange={(e) => setSettings({ ...settings, nacional2Rate: Number(e.target.value) })}
                min={0}
                required
              />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>CPs 8000 al 9999 (Río Negro, Neuquén, Chubut, TDF)</span>
            </div>

            <div style={{ marginTop: 24 }}>
              <button type="submit" className="btn btn--primary btn--full" disabled={saving}>
                <FiSave /> {saving ? 'Guardando...' : 'Guardar nuevas tarifas'}
              </button>
            </div>
          </form>
        </div>

        {/* Herramientas de Ajuste Masivo y Prueba */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Ajuste Masivo Porcentual */}
          <div className="admin-card" style={{ background: 'var(--color-bg-alt)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-md)', color: 'var(--color-primary)' }}>
              <FiTrendingUp /> Ajuste Masivo Porcentual
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 16 }}>
              Aplicá un aumento o descuento porcentual a las 4 zonas al mismo tiempo cuando Correo Argentino anuncie variaciones.
            </p>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => applyPercentageAdjustment(5)}>
                +5%
              </button>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => applyPercentageAdjustment(10)}>
                +10%
              </button>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => applyPercentageAdjustment(15)}>
                +15%
              </button>
              <button type="button" className="btn btn--outline btn--sm" onClick={() => applyPercentageAdjustment(20)}>
                +20%
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                className="form-input"
                value={percentageInput}
                onChange={(e) => setPercentageInput(Number(e.target.value))}
                style={{ width: 100 }}
                placeholder="%"
              />
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => applyPercentageAdjustment(percentageInput)}>
                Aplicar {percentageInput}%
              </button>
            </div>
          </div>

          {/* Probador de Cotizaciones */}
          <div className="admin-card" style={{ background: 'var(--color-bg)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-md)' }}>
              <FiSearch /> Probador de Cotización en Tiempo Real
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 16 }}>
              Comprobá cómo verán los clientes el cálculo según el CP y el peso del paquete.
            </p>

            <form onSubmit={handleTestCalculations} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                className="form-input"
                placeholder="CP (ej: 1425)"
                maxLength={4}
                value={testZip}
                onChange={(e) => setTestZip(e.target.value.replace(/\D/g, ''))}
                style={{ width: 110 }}
              />
              <input
                type="number"
                className="form-input"
                placeholder="Gramos (ej: 500)"
                value={testWeight}
                onChange={(e) => setTestWeight(Number(e.target.value))}
                style={{ width: 130 }}
              />
              <button type="submit" className="btn btn--outline btn--sm" disabled={testing || testZip.length !== 4}>
                {testing ? 'Probando...' : 'Cotizar'}
              </button>
            </form>

            {testQuotes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {testQuotes.map((q) => (
                  <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-bg-alt)', borderRadius: 8, fontSize: 'var(--text-xs)' }}>
                    <div>
                      <strong>{q.name}</strong>
                      <div style={{ color: 'var(--color-text-muted)' }}>{q.estimatedDays}</div>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: 'var(--text-sm)' }}>
                      {formatPrice(q.price)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
