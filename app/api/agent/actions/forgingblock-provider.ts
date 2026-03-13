import { ActionProvider, WalletProvider } from "@coinbase/agentkit"
import { z } from "zod"

const API = process.env.FORGINGBLOCK_API || "https://api.forgingblock.io"
const FB_API_KEY = process.env.FB_API_KEY
const apiVersion = "v1"

class ForgingblockActionProvider extends ActionProvider<WalletProvider> {

    constructor() {
        super("forgingblock", [])
    }

    supportsNetwork(): boolean {
        return true
    }

    getActions(_walletProvider: WalletProvider) {

        const actions: any[] = [

            {
                name: "create_payment",

                description:
                    "Create a ForgingBlock payment from a checkout URL or checkout ID",

                schema: z.object({
                    id: z.string().optional(),
                    url: z.string().optional()
                }),

                invoke: async ({ id, url }: { id?: string; url?: string }): Promise<string> => {

                    const params = new URLSearchParams()

                    if (id) params.set("id", id)
                    if (url) params.set("url", url)

                    const endpoint = `${API}/api/${apiVersion}/pay/resolve?${params}`

                    try {

                        const res = await fetch(endpoint)

                        if (!res.ok) {
                            const body = await res.text()

                            return JSON.stringify({
                                error: "create_payment_failed",
                                status: res.status,
                                endpoint,
                                body
                            })
                        }

                        const data = await res.json()

                        if (data.recommended_tx?.chainId) {
                            data.recommended_tx.chainId = Number(data.recommended_tx.chainId)
                        }

                        console.log("recommendedTx", data.recommended_tx)

                        return JSON.stringify({
                            invoiceId: data.invoice_id,
                            invoiceUrl: data.invoice_url,
                            network: data.network,
                            token: data.token,
                            amount: data.amount,
                            paymentAddress: data.payment_address,
                            recommendedTx: data.recommended_tx,
                            verifyUrl: data.verify_url,
                            debug: {
                                endpoint,
                                recommendedTx: data.recommended_tx
                            }
                        })

                    } catch (err: any) {

                        return JSON.stringify({
                            error: "create_payment_exception",
                            endpoint,
                            message: err?.message || String(err)
                        })

                    }
                }
            },

            {
                name: "verify_payment",

                description:
                    "Verify the payment status of a ForgingBlock invoice",

                schema: z.object({
                    invoiceId: z.string()
                }),

                invoke: async ({ invoiceId }: { invoiceId: string }): Promise<string> => {

                    const endpoint =
                        `${API}/api/${apiVersion}/pay/verify/${invoiceId}`

                    try {

                        const res = await fetch(endpoint)

                        if (!res.ok) {
                            const body = await res.text()

                            return JSON.stringify({
                                error: "verify_failed",
                                status: res.status,
                                endpoint,
                                body
                            })
                        }

                        const data = await res.json()

                        return JSON.stringify({
                            invoiceId: data.invoice_id,
                            orderId: data.order_id,
                            status: data.status,
                            cryptoAmount: data.crypto_amount,
                            overpaid: data.crypto_overpaid_amount,
                            underpaid: data.crypto_underpaid_amount,
                            debug: { endpoint }
                        })

                    } catch (err: any) {

                        return JSON.stringify({
                            error: "verify_exception",
                            endpoint,
                            message: err?.message || String(err)
                        })

                    }
                }
            }

        ]

        /*
         Add create_order ONLY if FB_API_KEY exists
        */

        if (FB_API_KEY) {

            actions.push({

                name: "create_order",

                description:
                    "Create a new ForgingBlock payment order and return checkout URL",

                schema: z.object({
                    price_amount: z.number(),
                    price_currency: z.string(),
                    title: z.string().optional(),
                    description: z.string().optional()
                }),

                invoke: async ({
                    price_amount,
                    price_currency,
                    title,
                    description
                }: any): Promise<string> => {

                    const endpoint = `${API}/api/${apiVersion}/orders`

                    try {

                        const res = await fetch(endpoint, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${FB_API_KEY}`
                            },
                            body: JSON.stringify({
                                price_amount,
                                price_currency,
                                title,
                                description
                            })
                        })

                        if (!res.ok) {
                            const body = await res.text()

                            return JSON.stringify({
                                error: "create_order_failed",
                                status: res.status,
                                endpoint,
                                body
                            })
                        }

                        const data = await res.json()

                        return JSON.stringify({
                            orderId: data.order_id,
                            invoiceUrl: data.invoice_url,
                            checkoutUrl: data.checkout_url,
                            checkoutId: data.checkout_id,
                            priceAmount: data.price_amount,
                            priceCurrency: data.price_currency
                        })

                    } catch (err: any) {

                        return JSON.stringify({
                            error: "create_order_exception",
                            endpoint,
                            message: err?.message || String(err)
                        })

                    }
                }
            })
        }

        return actions
    }
}

export function forgingblockActionProvider() {
    return new ForgingblockActionProvider()
}