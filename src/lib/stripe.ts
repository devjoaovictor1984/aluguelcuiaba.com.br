import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
})

export const STRIPE_PRICES: Record<string, string> = {
  basico:        process.env.STRIPE_PRICE_BASICO!,
  profissional:  process.env.STRIPE_PRICE_PROFISSIONAL!,
}
