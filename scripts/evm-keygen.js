// Creates the company's EVM deposit key. Run on a trusted machine:
//   node scripts/evm-keygen.js            → new 24-word recovery phrase
//   node scripts/evm-keygen.js --check    → re-derive from a phrase you paste
// Prints EVM_XPUB for Netlify. The phrase itself NEVER goes into Netlify,
// git, chat or email: write it down and store it offline.
import { HDNodeWallet, Mnemonic } from 'ethers'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline/promises'

const ACCOUNT = "m/44'/60'/0'"
let phrase
if (process.argv.includes('--check')) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  phrase = (await rl.question('Recovery phrase: ')).trim().toLowerCase().replace(/\s+/g, ' ')
  rl.close()
} else {
  phrase = Mnemonic.fromEntropy(randomBytes(32)).phrase
}
const account = HDNodeWallet.fromPhrase(phrase, undefined, ACCOUNT)
const xpub = account.neuter().extendedKey
const first = account.deriveChild(0).deriveChild(0).address

if (!process.argv.includes('--check')) {
  console.log('\nRECOVERY PHRASE — write it down, store it offline, never paste it anywhere:\n')
  console.log('  ' + phrase + '\n')
}
console.log('EVM_XPUB (safe to put in Netlify):\n')
console.log('  ' + xpub + '\n')
console.log(`First deposit address (${ACCOUNT}/0/0): ${first}`)
console.log('Check: importing the phrase into MetaMask shows this same first account.\n')
