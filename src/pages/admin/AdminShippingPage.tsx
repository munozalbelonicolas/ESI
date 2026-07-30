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
import { FiTruck, FiSave, FiTrendingUp, FiSearch, FiCheckCircle } from 'react-icons/fi';
import toast from 'react-hot-toast';

const ZONES: { key: keyof Omit<ShippingSettings, 'freeShippingMin'>; label: string; range: string }[] = [
  { key: 'local', label: 'Local / AMBA', range: 'CABA y Gran Buenos Aires' },
  { key: 'regional', label: 'Regional', range: 'Prov. Buenos Aires, Córdoba, Santa Fe' },
  { key: 'nacional1', label: 'Nacional 1', range: 'NOA, NEA, Cuyo' },
  { key: 'nacional2', label: 'Nacional 2', range: 'Patagonia y Extremo Sur' },
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
    zoneKey: keyof Omit<ShippingSettings, 'freeShippingMin'>,
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
      toast.success('Matriz de tarifas por tramos de peso guardada correctamente');
    } catch (err: any) {
      console.error(err);
      toast.error('Error al guardar tarifas');
    } finally {
      setSaving(false);
    }
  };

  const applyPercentageAdjustment = (percent: number) => {
    const factor = 1 + percent / 100;
    const updatedSettings: ShippingSettings = { ...settings };

    ZONES.forEach(({ key }) => {
      updatedSettings[key] = {
        w500g: Math.round(settings[key].w500g * factor),
        w1kg: Math.round(settings[key].w1kg * factor),
        w3kg: Math.round(settings[key].w3kg * factor),
        w5kg: Math.round(settings[key].w5kg * factor),
      };
    });

    setSettings(updatedSettings);
    toast.success(`Ajuste de ${percent > 0 ? '+' : ''}${percent}% aplicado a la matriz. Guardá para confirmar.`);
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
          <h1>Matriz de Tarifas por Peso — Correo Argentino</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            Configurá el precio exacto en pesos por cada tramo de peso (500g, 1kg, 3kg, 5kg) y por cada zona geográfica.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* Tabla Matriz de Tarifas */}
        <div className="admin-card" style={{ background: 'var(--color-bg)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)', marginBottom: 24, overflowX: 'auto' }}>
          <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-lg)' }}>
            <FiTruck style={{ color: 'var(--color-primary)' }} /> Matriz Tarifaria Oficial (Precios base en ARS)
          </h3>

          <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-alt)' }}>
                <th style={{ padding: 12 }}>Zona Geográfica</th>
                <th style={{ padding: 12, textAlign: 'center' }}>Hasta 500g</th>
                <th style={{ padding: 12, textAlign: 'center' }}>500g a 1 kg</th>
                <th style={{ padding: 12, textAlign: 'center' }}>1 kg a 3 kg</th>
                <th style={{ padding: 12, textAlign: 'center' }}>3 kg a 5 kg</th>
              </tr>
            </thead>
            <tbody>
              {ZONES.map(({ key, label, range }) => (
                <tr key={key} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: 12 }}>
                    <strong style={{ display: 'block', color: 'var(--color-text)' }}>{label}</strong>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{range}</span>
                  </td>
                  <td style={{ padding: 12 }}>
                    <input
                      type="number"
                      className="form-input"
                      value={settings[key].w500g}
                      onChange={(e) => handleCellChange(key, 'w500g', Number(e.target.value))}
                      style={{ textAlign: 'center', width: '100%' }}
                      min={0}
                      required
                    />
                  </td>
                  <td style={{ padding: 12 }}>
                    <input
                      type="number"
                      className="form-input"
                      value={settings[key].w1kg}
                      onChange={(e) => handleCellChange(key, 'w1kg', Number(e.target.value))}
                      style={{ textAlign: 'center', width: '100%' }}
                      min={0}
                      required
                    />
                  </td>
                  <td style={{ padding: 12 }}>
                    <input
                      type="number"
                      className="form-input"
                      value={settings[key].w3kg}
                      onChange={(e) => handleCellChange(key, 'w3kg', Number(e.target.value))}
                      style={{ textAlign: 'center', width: '100%' }}
                      min={0}
                      required
                    />
                  </td>
                  <td style={{ padding: 12 }}>
                    <input
                      type="number"
                      className="form-input"
                      value={settings[key].w5kg}
                      onChange={(e) => handleCellChange(key, 'w5kg', Number(e.target.value))}
                      style={{ textAlign: 'center', width: '100%' }}
                      min={0}
                      required
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn--primary btn--lg" disabled={saving}>
              <FiSave /> {saving ? 'Guardando matriz...' : 'Guardar Matriz de Tarifas'}
            </button>
          </div>
        </div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Ajuste Masivo Porcentual */}
        <div className="admin-card" style={{ background: 'var(--color-bg-alt)', padding: 24, borderRadius: 12, border: '1px solid var(--color-border)' }}>
          <h3 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-md)', color: 'var(--color-primary)' }}>
            <FiTrendingUp /> Ajuste Porcentual a Toda la Matriz
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Calculá un aumento o descuento porcentual sobre las 16 celdas de la tabla simultáneamente.
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
            <FiSearch /> Probador de Cotización
          </h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Verificá la cotización para cualquier Código Postal y peso en gramos.
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
              placeholder="Gramos (ej: 1500)"
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
