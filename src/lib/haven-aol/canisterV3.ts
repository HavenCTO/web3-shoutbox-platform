/**
 * Minimal v3 canister surface, ported from haven-dapp's
 * haven-aol-client (the `haven-aol` package ships no v3 actor).
 * The IDL must stay identical to the canister's v3 service entries.
 */
import { Actor, HttpAgent, AnonymousIdentity, type ActorMethod, type ActorSubclass } from '@icp-sdk/core/agent'
import { IDL } from '@icp-sdk/core/candid'
import { env } from '@/config/env'
import type { Chain } from './core/types'

export interface AolConfig { host: string; canisterId: string; eip712ChainId: bigint; eip712VerifyingContract: string }

export function getAolConfig(): AolConfig {
  return {
    host: env.VITE_ICP_HOST,
    canisterId: env.VITE_HAVEN_AOL_CANISTER_ID,
    eip712ChainId: BigInt(env.VITE_EIP712_CHAIN_ID),
    eip712VerifyingContract: env.VITE_EIP712_VERIFYING_CONTRACT,
  }
}

let cachedAgent: HttpAgent | null = null
export async function getAgent(): Promise<HttpAgent> {
  if (cachedAgent) return cachedAgent
  cachedAgent = await HttpAgent.create({ host: getAolConfig().host, identity: new AnonymousIdentity(), verifyQuerySignatures: false })
  return cachedAgent
}

const ChainV3Variant = IDL.Variant({ EthMainnet: IDL.Null, EthSepolia: IDL.Null, ArbitrumOne: IDL.Null, BaseMainnet: IDL.Null, OptimismMainnet: IDL.Null })
const GateRequestV3Type = IDL.Record({
  chain: ChainV3Variant, tokenAddress: IDL.Text, threshold: IDL.Nat, epoch: IDL.Nat,
  evmAddress: IDL.Text, transportPublicKey: IDL.Vec(IDL.Nat8), nonce: IDL.Nat,
  signature: IDL.Vec(IDL.Nat8), eip712ChainId: IDL.Nat, eip712VerifyingContract: IDL.Text,
})
const GateErrorV3Variant = IDL.Variant({
  InsufficientBalance: IDL.Record({ required: IDL.Nat, actual: IDL.Nat }),
  InvalidAddress: IDL.Text, InvalidThreshold: IDL.Null, EvmRpcError: IDL.Text,
  VetKDError: IDL.Text, InvalidSignature: IDL.Text, NonceAlreadyUsed: IDL.Null, InvalidEpoch: IDL.Null,
})
const GateResultV3Variant = IDL.Variant({
  ok: IDL.Record({ encrypted_key: IDL.Vec(IDL.Nat8), verification_key: IDL.Vec(IDL.Nat8) }),
  err: GateErrorV3Variant,
})

interface V3Actor {
  requestDecryptionKeyV3: ActorMethod<[unknown], { ok: { encrypted_key: Uint8Array | number[]; verification_key: Uint8Array | number[] } } | { err: unknown }>
}

let actor: ActorSubclass<V3Actor> | null = null
function getActor(agent: HttpAgent): ActorSubclass<V3Actor> {
  if (actor) return actor
  actor = Actor.createActor<V3Actor>(() => IDL.Service({ requestDecryptionKeyV3: IDL.Func([GateRequestV3Type], [GateResultV3Variant], []) }), { agent, canisterId: getAolConfig().canisterId })
  return actor
}

export interface GateRequestV3Wire {
  chain: Chain; tokenAddress: string; threshold: bigint; epoch: bigint; evmAddress: string
  transportPublicKey: Uint8Array; nonce: bigint; signature: Uint8Array; eip712ChainId: bigint; eip712VerifyingContract: string
}

export type GateResultV3 = { ok: { encryptedKey: Uint8Array; verificationKey: Uint8Array } } | { err: unknown }

export async function requestDecryptionKeyV3(request: GateRequestV3Wire): Promise<GateResultV3> {
  const raw = await getActor(await getAgent()).requestDecryptionKeyV3({
    chain: { [request.chain]: null }, tokenAddress: request.tokenAddress, threshold: request.threshold,
    epoch: request.epoch, evmAddress: request.evmAddress, transportPublicKey: request.transportPublicKey,
    nonce: request.nonce, signature: request.signature, eip712ChainId: request.eip712ChainId,
    eip712VerifyingContract: request.eip712VerifyingContract,
  })
  if ('ok' in raw) return { ok: { encryptedKey: new Uint8Array(raw.ok.encrypted_key), verificationKey: new Uint8Array(raw.ok.verification_key) } }
  return { err: raw.err }
}

/** Human-readable canister gate error; InsufficientBalance drives the faucet wait. */
export function gateErrorKind(err: unknown): 'insufficient' | 'nonce' | 'other' {
  if (err && typeof err === 'object') {
    if ('InsufficientBalance' in err) return 'insufficient'
    if ('NonceAlreadyUsed' in err) return 'nonce'
  }
  return 'other'
}
export function gateErrorText(err: unknown): string {
  if (err && typeof err === 'object') {
    const [k, v] = Object.entries(err as Record<string, unknown>)[0] ?? []
    if (k === 'InsufficientBalance') { const r = v as { required: bigint; actual: bigint }; return `Needs ${r.required} token units, guest holds ${r.actual}` }
    return `${k}: ${typeof v === 'string' ? v : ''}`.trim()
  }
  return String(err)
}
