import { useState, useEffect } from 'react';
import {
  getShippingSettings,
  saveShippingSettings,
  getShippingQuotes,
  type ShippingSettings,
  type ShippingQuote,
  type ZoneWeightRates,
  DEFAULT_SHIPPING_SETTINGS,
} from '../../services/shippingService';
import { formatPrice } from '../../utils/formatPrice';
import { FiTruck, FiSave, FiTrendingUp, FiSearch } from 'react-icons/fi';
import toast from 'react-hot-toast';

const ZONES: { key: 'regional' | 'nacional'; label: string; desc: string }[] = [
  { key: 'regional', label: 'Regional', desc: 'CABA, GBA, Prov. BsAs, Santa Fe, Córdoba' },
  { key: 'nacional', label: 'Nacional', desc: 'Resto del país (NOA, NEA, Cuyo, Patagonia)' },
];

const WEIGHT_TIERS: { key: keyof ZoneWeightRates; label: string }[] = [
  { key: 'w1kg', label: 'Hasta 1kg' },
  { key: 'w5kg', label: 'Hasta 5kg' },
  { key: 'w10kg', label: 'Hasta 10kg' },
  { key: 'w15kg', label: 'Hasta 15kg' },
  { key: 'w20kg', label: 'Hasta 20kg' },
  { key: 'w25kg', label: 'Hasta 25kg' },
];

export default function AdminShippingPage() {
  const [settings, setSettings] = useState<ShippingSettings>(DEFAULT_SHIPPING_SETTINGS);
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

  const handleCellChange = (
    zoneKey: 'regional' | 'nacional',
    tierKey: keyof ZoneWeightRates,
    value: number
  ) => {
    setSettings((prev) => ({
      ...prev,
      [zoneKey]: {
        ...prev[zoneKey],
        [tierKey]: value,
      },
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveShippingSettings(settings);
      toast.success('Tabla oficial de tarifas de Correo Argentino guardada');
    } catch (err: any) {
      console.error(err);
      toast.error('Error al guardar tarifas');
    } finally {
      setSaving(false);
    }
  };

  const applyPercentageAdjustment = (percent: number) => {
    const factor = 1 + percent / 100;
    const updated: ShippingSettings = { ...settings };

    ZONES.forEach(({ key }) => {
      updated[key] = {
        w1kg: Math.round(settings[key].w1kg * factor),
        w5kg: Math.round(settings[key].w5kg * factor),
        w10kg: Math.round(settings[key].w10kg * factor),
        w15kg: Math.round(settings[key].w15kg * factor),
        w20kg: Math.round(settings[key].w20kg * factor),
        w25kg: Math.round(settings[key].w25kg * factor),
      };
    });

    setSettings(updated);
    toast.success(`Ajuste de ${percent > 0 ? '+' : ''}${percent}% aplicado a la matriz oficial.`);
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
          <h1>Tabla Tarifaria Oficial — Correo Argentino</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Visualizá y actualizá la tabla oficial de precios por clase de producto (peso) y cobertura (Regional vs Nacional).
          </p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* Tabla Oficial de Precios Correo Argentino */}
        <div className="admin-card" style={{ background: 'var(--color-bg)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)', marginBottom: 24, overflowX: 'auto' }}>
          <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-lg)' }}>
            <FiTruck style={{ color: 'var(--color-primary)' }} /> Tarifas Oficiales Correo Argentino (ARS $)
          </h3>

          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-alt)' }}>
                <th style={{ padding: 12 }}>Clase de Producto</th>
                {ZONES.map((z) => (
                  <th key={z.key} style={{ padding: 12, textAlign: 'center' }}>
                    <div>{z.label}</div>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'normal', color: 'var(--color-text-muted)' }}>{z.desc}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEIGHT_TIERS.map(({ key, label }) => (
                <tr key={key} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: 12, fontWeight: 600, color: 'var(--color-text)' }}>{label}</td>
                  {ZONES.map((z) => (
                    <td key={z.key} style={{ padding: 12 }}>
                      <input
                        type="number"
                        className="form-input"
                        value={settings[z.key][key]}
                        onChange={(e) => handleCellChange(z.key, key, Number(e.target.value))}
                        style={{ textAlign: 'center', width: '100%', fontWeight: 600 }}
                        min={0}
                        required
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn--primary btn--lg" disabled={saving}>
              <FiSave /> {saving ? 'Guardando...' : 'Guardar Tabla Oficial'}
            </button>
          </div>
        </div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Ajuste Masivo Porcentual */}
        <div className="admin-card" style={{ background: 'var(--color-bg-alt)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-md)', color: 'var(--color-primary)' }}>
            <FiTrendingUp /> Ajuste Porcentual Masivo
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Aplicá un aumento o ajuste masivo a toda la tabla oficial de precios.
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
            Comprobá qué cotización recibirá el cliente según su Código Postal y peso.
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
              placeholder="Gramos (ej: 800)"
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
  );
}
