# SalScan

A simple, lightweight blockchain explorer built with vanilla JavaScript and Ethers.js. This tool allows you to quickly search for transactions, addresses, and blocks on Ethereum and Polygon.

## Live Demo

This project is live and hosted on Vercel:
**[https://salcan.vercel.app/](https://salcan.vercel.app/)**

---

## Features

* **Network Switching:** Toggle between Ethereum Mainnet and Polygon.
* **Live Data:** View the latest blocks and transactions in real-time.
* **Universal Search:** Search by Address, `.eth` name, Transaction Hash, or Block Number.
* **Address Details:** View native balance, all ERC-20 token balances, and transaction history.
* **Transaction Details:** View receipt details like status, gas used, and value.
* **Block Details:** View block timestamp, fee recipient, gas used, and more.

---

## Tech Stack

* HTML
* Tailwind CSS
* JavaScript (ESM)
* Ethers.js
* Vite (for development and build)

---

## Running Locally

### Prerequisites

* Node.js (v18+)
* NPM
* RPC URLs for Ethereum, Polygon, and Base (from a provider like Alchemy or QuikNode)

### Setup and Run

1. **Clone the repository:**

   ```sh
   git clone [https://github.com/olaoyesalem/SalScan.git](https://github.com/olaoyesalem/SalScan.git)
   cd SalScan
   ```
2. **Install dependencies:**

   ```sh
   npm install
   ```
3. **Set up environment variables:**
   Create a `.env` file in the root of the project and add your RPC URLs.

   ```.env
   # .env
   # Used for the POL price feed
   VITE_BASE_RPC_URL="YOUR_BASE_RPC_URL"

   # Used for the main explorer
   VITE_ETH_RPC_URL="YOUR_ETH_RPC_URL"
   VITE_POLYGON_RPC_URL="YOUR_POLYGON_RPC_URL"
   ```
4. **Run the development server:**

   ```sh
   npm run dev
   ```

---

## Author

* **GitHub:** [@olaoyesalem](https://github.com/olaoyesalem)
* **Twitter:** @salthegeek1
* **Email:** olaoyesalemgreat@gmail.com
