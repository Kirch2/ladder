import { OrderBook } from "@/app/components/order-book";

export default function Home() {
  return (
    <main className="min-h-screen flex items-start justify-center px-6 sm:px-4 pt-10 pb-20">
      <OrderBook />
    </main>
  );
}
