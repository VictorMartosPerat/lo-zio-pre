import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Pizzería Lo Zio'

interface OrderReceivedProps {
  guestName?: string
  shortId?: string
  totalAmount?: number
  orderType?: 'pickup' | 'delivery'
  pickupStore?: string | null
  deliveryAddress?: string | null
  paymentMethod?: 'cash' | 'card'
  paymentStatus?: string
  estimatedMinutes?: number
}

const STORE_NAMES: Record<string, string> = {
  tarragona: 'Lo Zio Tarragona — Carrer Reding 32, Tarragona · +34 687 605 647',
  arrabassada: 'Lo Zio Arrabassada — Carrer Joan Fuster 28, Tarragona · +34 682 239 035',
}

const OrderReceivedEmail = ({
  guestName,
  shortId,
  totalAmount,
  orderType,
  pickupStore,
  deliveryAddress,
  paymentMethod,
  paymentStatus,
  estimatedMinutes,
}: OrderReceivedProps) => {
  const isDelivery = orderType === 'delivery'
  const isCash = paymentMethod === 'cash'
  const storeLabel = pickupStore ? (STORE_NAMES[pickupStore] ?? pickupStore) : null

  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>Hemos recibido tu pedido #{shortId ?? ''} en {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>{SITE_NAME}</Text>
            <Heading style={h1}>📥 Hemos recibido tu pedido</Heading>
          </Section>

          <Section style={body}>
            <Text style={greeting}>Hola{guestName ? `, ${guestName}` : ''} 👋</Text>
            <Text style={text}>
              Gracias por tu pedido. Lo estamos revisando y te confirmaremos en breve si lo aceptamos.
              Tiempo estimado tras la aceptación: <strong>{estimatedMinutes ?? 30} minutos</strong>.
            </Text>

            <Section style={card}>
              <Text style={cardLabel}>Pedido</Text>
              <Text style={cardValue}>#{shortId ?? '—'}</Text>
              {typeof totalAmount === 'number' && (
                <Text style={cardTotal}>{totalAmount.toFixed(2)} €</Text>
              )}
              <Text style={cardMeta}>
                {isDelivery ? '🛵 Entrega a domicilio' : '🏪 Recogida en tienda'}
              </Text>
              {isDelivery && deliveryAddress && (
                <Text style={cardMeta}>📍 {deliveryAddress}</Text>
              )}
              {!isDelivery && storeLabel && (
                <Text style={cardMeta}>📍 {storeLabel}</Text>
              )}
              <Text style={cardMeta}>
                {isCash ? '💵 Pago en efectivo' : `💳 Pago con tarjeta${paymentStatus === 'paid' ? ' (pagado)' : ''}`}
              </Text>
            </Section>

            <Text style={footer}>
              Te enviaremos otro email en cuanto el restaurante acepte o rechace tu pedido.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OrderReceivedEmail,
  subject: (d: Record<string, any>) =>
    `📥 Hemos recibido tu pedido${d.shortId ? ` #${d.shortId}` : ''} — ${SITE_NAME}`,
  displayName: 'Pedido recibido',
  previewData: {
    guestName: 'María',
    shortId: 'A1B2C3D4',
    totalAmount: 24.5,
    orderType: 'delivery',
    deliveryAddress: 'Carrer Exemple 12, Tarragona',
    paymentMethod: 'card',
    paymentStatus: 'paid',
    estimatedMinutes: 30,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '32px auto', backgroundColor: '#fdfaf5', borderRadius: '12px', overflow: 'hidden', border: '1px solid #ecdfca' }
const header = { backgroundColor: '#7a1f1f', padding: '28px 32px', textAlign: 'center' as const }
const brand = { color: '#f5e9d4', fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase' as const, margin: '0 0 6px', fontFamily: 'Arial, sans-serif' }
const h1 = { color: '#ffffff', fontSize: '22px', margin: 0 }
const body = { padding: '24px 32px' }
const greeting = { color: '#3a2418', fontSize: '16px', margin: '0 0 4px' }
const text = { color: '#5b4738', fontSize: '15px', lineHeight: 1.55, margin: '4px 0 20px' }
const card = { backgroundColor: '#ffffff', border: '1px solid #ecdfca', borderRadius: '10px', padding: '16px 18px', margin: '8px 0 16px' }
const cardLabel = { color: '#9a7d63', fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '1px', margin: '0 0 4px', fontFamily: 'Arial, sans-serif' }
const cardValue = { color: '#3a2418', fontSize: '14px', fontFamily: 'monospace', margin: '0 0 6px' }
const cardTotal = { color: '#7a1f1f', fontSize: '22px', fontWeight: 'bold' as const, margin: '0 0 10px' }
const cardMeta = { color: '#5b4738', fontSize: '13px', margin: '4px 0' }
const footer = { color: '#9a7d63', fontSize: '13px', textAlign: 'center' as const, marginTop: '20px' }
