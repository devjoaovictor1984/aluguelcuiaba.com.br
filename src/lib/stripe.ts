import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

export const STRIPE_PRICES: Record<string, string> = {
  basico:        process.env.STRIPE_PRICE_BASICO!,
  profissional:  process.env.STRIPE_PRICE_PROFISSIONAL!,
}

// Mapa reverso price_id → plano. Usado no webhook pra detectar troca de plano
// feita pelo Portal do Stripe (evento customer.subscription.updated).
export function planoDoPrice(priceId: string | null | undefined): 'basico' | 'profissional' | null {
  if (!priceId) return null
  if (priceId === process.env.STRIPE_PRICE_BASICO) return 'basico'
  if (priceId === process.env.STRIPE_PRICE_PROFISSIONAL) return 'profissional'
  return null
}
