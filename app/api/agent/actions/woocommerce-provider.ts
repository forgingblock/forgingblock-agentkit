import { ActionProvider, WalletProvider } from "@coinbase/agentkit"
import { z } from "zod"

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

    getActions(_walletProvider: WalletProvider) {
        return [
            {
                name: "detect_woocommerce_capabilities",
                description: "Detect if WooCommerce store supports agent API",
                schema: z.object({
                    url: z.string()
                }),
                invoke: async ({ url }: { url: string }) => {
                    try {
                        const base = new URL(url).origin
                        const res = await fetch(
                            `${base}/wp-json/forgingblock/v1/agent/products`
                        )
                        return JSON.stringify({
                            base,
                            hasAgentApi: res.ok
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
                name: "woo_search_products",
                description: "Search products",
                schema: z.object({
                    base: z.string(),
                    query: z.string().optional(),
                    page: z.number().optional()
                }),
                invoke: async ({
                    base,
                    query = "",
                    page = 1
                }: {
                    base: string
                    query?: string
                    page?: number
                }) => {
                    try {
                        const res = await fetch(
                            `${base}/wp-json/forgingblock/v1/agent/products?q=${encodeURIComponent(query)}&page=${page}`
                        )
                        const data = await res.json()
                        if (!res.ok) {
                            return JSON.stringify({ error: "search_failed", body: data })
                        }
                        return JSON.stringify(data)
                    } catch (err: any) {
                        return JSON.stringify({
                            error: "search_failed",
                            message: err?.message
                        })
                    }
                }
            },
            {
                name: "woo_get_product",
                description: "Get product by id",
                schema: z.object({
                    base: z.string(),
                    product_id: z.number()
                }),
                invoke: async ({
                    base,
                    product_id
                }: {
                    base: string
                    product_id: number
                }) => {
                    try {
                        const res = await fetch(
                            `${base}/wp-json/forgingblock/v1/agent/products/${product_id}`
                        )
                        const data = await res.json()
                        if (!res.ok) {
                            return JSON.stringify({ error: "product_not_found", body: data })
                        }
                        return JSON.stringify(data)
                    } catch (err: any) {
                        return JSON.stringify({
                            error: "product_fetch_failed",
                            message: err?.message
                        })
                    }
                }
            },
            {
                name: "woo_prepare_checkout",
                description: "Prepare checkout",
                schema: z
                    .object({
                        base: z.string().optional(),
                        url: z.string().optional(),
                        product_id: z.number().optional(),
                        quantity: z.number().optional()
                    })
                    .refine(v => v.url || (v.base && v.product_id), {
                        message: "url OR (base + product_id) required"
                    }),
                invoke: async ({
                    base,
                    url,
                    product_id,
                    quantity = 1
                }: {
                    base?: string
                    url?: string
                    product_id?: number
                    quantity?: number
                }) => {
                    try {
                        let resolvedBase = base
                        if (!resolvedBase && url) {
                            resolvedBase = new URL(url).origin
                        }
                        if (!resolvedBase) {
                            return JSON.stringify({ error: "base_missing" })
                        }

                        let resolvedProductId = product_id

                        if (!resolvedProductId && url) {
                            const slug = extractSlug(url)
                            if (!slug) {
                                return JSON.stringify({ error: "invalid_product_url" })
                            }

                            const productRes = await fetch(
                                `${resolvedBase}/wp-json/wc/store/products?slug=${slug}`
                            )
                            const products = await productRes.json()

                            if (!productRes.ok || !products.length) {
                                return JSON.stringify({ error: "product_not_found" })
                            }

                            resolvedProductId = products[0].id
                        }

                        if (!resolvedProductId) {
                            return JSON.stringify({ error: "product_id_missing" })
                        }

                        const createRes = await fetch(
                            `${resolvedBase}/wp-json/forgingblock/v1/agent/create-order`,
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    product_id: resolvedProductId,
                                    quantity
                                })
                            }
                        )

                        const createData = await createRes.json()

                        if (!createRes.ok) {
                            return JSON.stringify({
                                error: "create_order_failed",
                                body: createData
                            })
                        }

                        const { order_id, order_key } = createData

                        const invoiceRes = await fetch(
                            `${resolvedBase}/wp-json/forgingblock/v1/agent/checkout`,
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
                        const invoiceUrl = invoiceData.invoice_url

                        if (!invoiceRes.ok || !invoiceUrl) {
                            return JSON.stringify({
                                error: "invoice_failed",
                                body: invoiceData
                            })
                        }

                        return JSON.stringify({
                            base: resolvedBase,
                            product_id: resolvedProductId,
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