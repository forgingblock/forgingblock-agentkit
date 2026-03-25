import { ActionProvider, WalletProvider } from "@coinbase/agentkit"
import { z } from "zod"

function resolveBase(url: string): string {
    const u = new URL(url)
    return `${u.protocol}//${u.host}`
}

function extractSlug(url: string): string | null {
    try {
        return new URL(url).pathname.split("/").filter(Boolean).pop() || null
    } catch {
        return null
    }
}

class WooCommerceActionProvider extends ActionProvider<WalletProvider> {
    constructor() {
        super("woocommerce", [])
    }

    supportsNetwork(): boolean {
        return true
    }

    getActions() {
        return [
            {
                name: "detect_woocommerce_capabilities",

                description:
                    "Detect if a WooCommerce store supports Store API and ForgingBlock plugin",

                schema: z.object({
                    url: z.string()
                }),

                invoke: async ({ url }: { url: string }): Promise<string> => {
                    try {
                        const base = new URL(url).origin

                        const wooRes = await fetch(`${base}/wp-json/wc/store/products`)
                        const hasWooStore = wooRes.ok

                        const fbRes = await fetch(
                            `${base}/wp-json/forgingblock/v1/agent/checkout`,
                            { method: "OPTIONS" }
                        )

                        const hasForgingBlock =
                            fbRes.status !== 404 && fbRes.status !== 501

                        return JSON.stringify({
                            base,
                            hasWooStore,
                            hasForgingBlock
                        })

                    } catch (err: any) {
                        return JSON.stringify({
                            error: "detection_failed",
                            message: err?.message
                        })
                    }
                }
            },
            {
                name: "woo_prepare_checkout",

                description:
                    "Prepare WooCommerce checkout and return a ForgingBlock invoice URL from a product URL",

                schema: z.object({
                    url: z.string(),
                    quantity: z.number().optional()
                }),

                invoke: async ({
                    url,
                    quantity = 1
                }: {
                    url: string
                    quantity?: number
                }) => {
                    try {
                        const base = new URL(url).origin
                        const slug = new URL(url).pathname.split("/").filter(Boolean).pop()

                        if (!slug) {
                            return JSON.stringify({ error: "invalid_product_url" })
                        }

                        const productRes = await fetch(
                            `${base}/wp-json/wc/store/products?slug=${slug}`
                        )

                        const products = await productRes.json()

                        if (!productRes.ok || !products.length) {
                            return JSON.stringify({ error: "product_not_found" })
                        }

                        const product = products[0]

                        const createRes = await fetch(
                            `${base}/wp-json/forgingblock/v1/agent/create-order`,
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    product_id: product.id,
                                    quantity
                                })
                            }
                        )

                        const createData = await createRes.json()
                        console.log(createData)

                        if (!createRes.ok) {
                            console.error("CREATE ORDER FAILED", createData)
                            return JSON.stringify({
                                error: "create_order_failed",
                                body: createData
                            })
                        }

                        const { order_id, order_key } = createData

                        const invoiceRes = await fetch(
                            `${base}/wp-json/forgingblock/v1/agent/checkout`,
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    order_id,
                                    order_key
                                })
                            }
                        )
                        
                        const invoiceData = await invoiceRes.json()
console.log(invoiceData)
                        const invoiceUrl = invoiceData.invoice_url

                        if (!invoiceRes.ok || !invoiceUrl) {
                            console.error("CHECKOUT FAILED", invoiceData)
                            return JSON.stringify({
                                error: "invoice_failed",
                                body: invoiceData
                            })
                        }

                        return JSON.stringify({
                            base,
                            product_id: product.id,
                            order_id,
                            order_key,
                            invoice_url: invoiceUrl,
                            total: invoiceData.total,
                            currency: invoiceData.currency
                        })

                    } catch (err: any) {
                        return JSON.stringify({
                            error: "prepare_checkout_failed",
                            message: err?.message || String(err)
                        })
                    }
                }
            }
        ]
    }
}

export function woocommerceActionProvider() {
    return new WooCommerceActionProvider()
}