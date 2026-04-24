import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Pizzería Lo Zio'

interface OrderStatusUpdateProps {
  guestName?: string
  shortId?: string
  totalAmount?: number
  status?: 'confirmed' | 'cancelled'
  estimatedMinutes?: number
  readyTime?: string // HH:MM
  rejectionReason?: string
  pickupStore?: string | null
  refunded?: boolean
}

const STORE_NAMES: Record<string, string> = {
  tarragona: 'Lo Zio Tarragona — Carrer Reding 32, Tarragona · +34 687 605 647',
  arrabassada: 'Lo Zio Arrabassada — Carrer Joan Fuster 28, Tarragona · +34 682 239 035',
}

const OrderStatusUpdateEmail = ({
  guestName,
  shortId,
  totalAmount,
  status,
  estimatedMinutes,
  readyTime,
  rejectionReason,
  pickupStore,
  refunded,
}: OrderStatusUpdateProps) => {
  const isConfirmed = status === 'confirmed'
  const emoji = isConfirmed ? '✅' : '❌'
  const title = isConfirmed ? 'Tu pedido ha sido aceptado' : 'Tu pedido no ha podido aceptarse'
  const message = isConfirmed
    ? `¡Estamos preparando tu pedido! Tiempo estimado: ${estimatedMinutes ?? 45} minutos${readyTime ? ` (listo aprox. a las ${readyTime})` : ''}.`
    : (rejectionReason || 'Lo sentimos, en este momento no podemos aceptar tu pedido. Llámanos directamente al local o inténtalo más tarde.')
  const storeLabel = pickupStore ? (STORE_NAMES[pickupStore] ?? pickupStore) : null

  return (
    <Html lang="es" dir="ltr">
      <Head />
      <Preview>{emoji} {title} — {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={isConfirmed ? headerOk : headerKo}>
            <Text style={brand}>{SITE_NAME}</Text>
            <Heading style={h1}>{emoji} {title}</Heading>
          </Section>

          <Section style={body}>
            <Text style={greeting}>Hola{guestName ? `, ${guestName}` : ''} 👋</Text>
            <Text style={text}>{message}</Text>

            <Section style={card}>
              <Text style={cardLabel}>Pedido</Text>
              <Text style={cardValue}>#{shortId ?? '—'}</Text>
              {typeof totalAmount === 'number' && (
                <Text style={cardTotal}>{totalAmount.toFixed(2)} €</Text>
              )}
              {storeLabel && <Text style={cardMeta}>📍 {storeLabel}</Text>}
            </Section>

            {!isConfirmed && refunded && (
              <Section style={refundBox}>
                <Text style={refundText}>
                  💳 Se ha procesado un <strong>reembolso automático</strong> al método de pago original.
                  Lo recibirás en 5–10 días hábiles.
                </Text>
              </Section>
            )}

            <Text style={footer}>¿Tienes alguna duda? Llámanos directamente al local.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: OrderStatusUpdateEmail,
  subject: (d: Record<string, any>) => {
    const label = d.status === 'confirmed' ? 'Aceptado' : 'Rechazado'
    const emoji = d.status === 'confirmed' ? '✅' : '❌'
    return `${emoji} Tu pedido${d.shortId ? ` #${d.shortId}` : ''} — ${label}`
  },
  displayName: 'Estado del pedido (aceptado/rechazado)',
  previewData: {
    guestName: 'María',
    shortId: 'A1B2C3D4',
    totalAmount: 24.5,
    status: 'confirmed',
    estimatedMinutes: 45,
    readyTime: '21:30',
    pickupStore: 'tarragona',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif', margin: 0, padding: 0 }
const container = { maxWidth: '560px', margin: '32px auto', backgroundColor: '#fdfaf5', borderRadius: '12px', overflow: 'hidden', border: '1px solid #ecdfca' }
const headerOk = { backgroundColor: '#2f5d3a', padding: '28px 32px', textAlign: 'center' as const }
const headerKo = { backgroundColor: '#7a1f1f', padding: '28px 32px', textAlign: 'center' as const }
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
const refundBox = { backgroundColor: '#f3e8ff', border: '1px solid #d8b4fe', borderRadius: '8px', padding: '12px 16px', margin: '0 0 16px' }
const refundText = { color: '#7e22ce', fontSize: '13px', margin: 0 }
const footer = { color: '#9a7d63', fontSize: '13px', textAlign: 'center' as const, marginTop: '20px' }
