import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import ThemeProvider from "@/components/ThemeProvider";
import { CartProvider } from "@/context/CartContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "PLANT | Vaso Intelligente",
  description: "PLANT è un vaso intelligente dal design minimal ed elegante. Integra sensori e irrigazione automatica per la cura del tuo verde domestico.",
  keywords: "vaso intelligente, cura piante, smart home, botanica, iot",
};

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body className={`${inter.className} light-mode`}>
        <ThemeProvider>
          <CartProvider>
            <Navbar />
            {children}
            <Footer />
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
