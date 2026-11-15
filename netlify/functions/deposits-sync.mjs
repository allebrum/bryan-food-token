// Scheduled: register new deposit addresses with Alchemy and credit deposits
// that have enough confirmations. Users watching a deposit also trigger the
// confirm step for their own deposits, so this can run infrequently.
import { syncDeposits } from '../../server/deposits.js'

export default async () => {
  const result = await syncDeposits()
  console.log('deposit sync', result)
  return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } })
}

export const config = { schedule: '*/10 * * * *' }
