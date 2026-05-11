import { OrderBook } from "@/app/components/order-book";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-6 sm:px-4 pt-10 pb-20">
      <header className="mb-5 text-center">
        <h1 className="text-[15px] font-semibold text-text">
          Hyperliquid Order Book
        </h1>
        <p className="mt-0.5 text-[12px] text-muted">
          Live L2 depth for BTC and ETH
        </p>
      </header>
      <OrderBook />
    </main>
  );
}
