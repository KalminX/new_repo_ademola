# Centron Bot 🤖

A powerful **Telegram trading bot** built with **Node.js** and **Prisma**, designed for seamless token trading on the **Sui blockchain** with support for advanced features like limit orders, DCA, PnL tracking, referral system, copy trading, cross-chain bridging, and multiple wallet management.

---

## 🚀 Features

### 🔑 Wallet Management
- Import existing wallet (seed phrase/private key)  
- Generate new wallet with one click  
- Support for multiple wallets with custom names  
- Encrypted storage of private keys and seed phrases

### 💹 Trading
- Buy/Sell tokens with custom amounts  
- Configurable **slippage per wallet** or for **all wallets**  
- Multi-wallet selection for simultaneous trading  
- Real-time token info (price, market cap, liquidity, etc.)  

### 📊 Positions & PnL Tracking
- Live position tracking per token  
- Balance in both **SUI** and **USD**  
- Average entry price, current price, and **PnL % / PnL value**  
- Quick action buttons (Buy / Sell / Chart links)  

### ⏳ Advanced Orders
- **Limit Orders** → Buy/sell when market cap or price hits target  
- **DCA Orders** → Automatically buy tokens at intervals  

### 👥 Copy Trading
- Track and mirror trades from successful wallets  
- Add multiple wallets to copy from  
- Customize settings per tracked wallet:
  - **Custom labels** for easy identification
  - **Auto-buy amounts** → Automatically buy tokens when tracked wallet buys
  - **Auto-sell percentages** → Mirror sell percentage when tracked wallet sells
  - **Custom slippage** per tracked wallet
- Enable/disable copy trading per wallet
- Real-time trade mirroring

### 🌉 Cross-Chain Bridge
- Bridge assets from multiple chains to SUI:
  - **SOL** → SUI
  - **ETH** → SUI
  - **BTC** → SUI
  - **SUI** → Other chains
- Powered by **ChangeNOW API**
- Real-time exchange rate calculation
- Transaction status tracking with refresh functionality
- Unique deposit addresses for each transaction
- Secure and automated bridging process

### 🎁 Referral System
- Generate unique referral links  
- Tiered commission structure:
  - **20%** of trading fees in the first month  
  - **10%** of trading fees in the second month  
  - **5%** of trading fees forever after  
- Real-time earnings tracking  
- Automatic reward distribution  

### 💬 Interactive Telegram UI
- Inline keyboards for all actions  
- Wallet toggle buttons (`w0`, `w1`, etc.)  
- Dynamic message updates (edits instead of spamming new messages)  
- QR code generation for wallet addresses and referral links  
- Clean and intuitive button layouts

---

## 🛠️ Tech Stack
- **Backend:** Node.js  
- **Database:** SQLite with Prisma ORM  
- **Cache:** Redis  
- **Blockchain:** Sui + Cetus SDK + Aftermath SDK  
- **Bridge API:** ChangeNOW v2 API
- **Telegram API:** [Telegraf](https://telegraf.js.org/)  
- **Image Generation:** node-canvas + QRCode  
- **Security:** Encrypted wallet storage with crypto module  

---

## 📦 Setup & Installation

### 1. Clone the repo
```bash
git clone https://github.com/GOODBADBOY10/centron-bot.git
cd centron-bot
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables

Create a `.env` file in the root directory:
```env
# ======= Server Config =======
PORT=3000
PUBLIC_URL=https://your-app-name.onrender.com

# ======= Telegram Bot =======
BOT_TOKEN=your_telegram_bot_token
BOT_USERNAME=your_bot_username

# ======= Database =======
DATABASE_URL="file:./dev.db"

# ======= Security =======
ENCRYPTION_SECRET=your_32_character_encryption_key

# ======= API Keys =======
BLOCKBERRYAPIKEY=your_blockberry_api_key
INSIDEX_KEY=your_insidex_api_key
BIRD_EYE_API_KEY=your_birdeye_api_key
CHANGENOW_API_KEY=your_changenow_api_key
```

### 4. Initialize the database
```bash
# Generate Prisma Client
npx prisma generate

# Create database and run migrations
npx prisma migrate dev --name init

# (Optional) View your database in Prisma Studio
npx prisma studio
```

### 5. Run the bot
```bash
# Development mode
npm run dev

# Production mode
npm start
```

---

## 📁 Project Structure
```
centron-bot/
├── src/
│   ├── bot/
│   │   ├── action/
│   │   │   ├── handleBridgeAmountInput.js    # Bridge amount processing
│   │   │   ├── handleCopyTradeInput.js       # Copy trade settings
│   │   │   └── ...
│   │   ├── callbacks/                        # Callback query handlers
│   │   ├── handlers/
│   │   │   └── messageHandler.js             # Message routing
│   │   └── menus/
│   │       ├── bridgeMenu.js                 # Bridge interface
│   │       └── ...
│   ├── services/
│   │   ├── userService.js                    # User data management
│   │   ├── walletService.js                  # Wallet operations
│   │   └── copytradeService.js               # Copy trading logic
│   ├── transactions/
│   │   ├── bridge/
│   │   │   └── bridgeService.js              # ChangeNOW integration
│   │   └── ...
│   └── controllers/
│       ├── lib/
│       │   ├── db.js                         # Database functions
│       │   ├── handleStart.js                # /start command handler
│       │   ├── handleReferrals.js            # Referral system
│       │   ├── referralRewards.js            # Reward calculation
│       │   └── ...
│       └── ...
├── prisma/
│   ├── schema.prisma                         # Database schema
│   └── migrations/                           # Database migrations
├── .env                                      # Environment variables
├── package.json
└── README.md
```

---

## 🗄️ Database Schema

The bot uses SQLite with Prisma ORM. Key models include:

- **User** - Telegram user data and referral earnings
- **Wallet** - Encrypted wallet credentials
- **Referral** - Referral relationships and earnings tracking
- **Position** - Trading positions and PnL
- **LimitOrder** - Conditional orders
- **DcaOrder** - Dollar-cost averaging orders
- **Slippage** - Custom slippage settings
- **CopyTradeWallet** - Tracked wallets for copy trading with custom settings
- **BridgeTransaction** - Cross-chain bridge transaction records

View the complete schema in `prisma/schema.prisma`

---

## 🔐 Security Features

- ✅ Encrypted private keys and seed phrases
- ✅ Secure wallet storage with AES-256 encryption
- ✅ Environment-based encryption keys
- ✅ Self-referral prevention
- ✅ Duplicate referral protection
- ✅ Secure bridge transaction handling
- ✅ Safe copy trading with configurable limits

---

## 📊 Referral System

### How it works:
1. User A shares their referral link: `https://t.me/bot?start=ref_USERID`
2. User B clicks the link and starts the bot
3. When User B trades, User A earns:
   - **20%** of fees (first 30 days)
   - **10%** of fees (days 31-60)
   - **5%** of fees (forever after)
4. Earnings are automatically tracked and displayed

### Check your referral stats:
```
/referrals - View your referral link, count, and earnings
```

---

## 👥 Copy Trading Guide

### Setup:
1. Navigate to **Copy Trade** menu
2. Add wallet address to track
3. Configure settings:
   - **Label:** Custom name for the wallet
   - **Auto Buy Amount:** Amount in SUI to automatically buy when tracked wallet buys
   - **Auto Sell %:** Percentage to sell when tracked wallet sells
   - **Slippage:** Custom slippage tolerance
4. Toggle **On/Off** to enable/disable tracking

### How it works:
- Bot monitors tracked wallets for buy/sell transactions
- Automatically mirrors trades based on your settings
- Executes trades using your configured parameters
- Real-time notifications for mirrored trades

---

## 🌉 Bridge Guide

### Supported Routes:
- **SOL → SUI**
- **ETH → SUI**
- **BTC → SUI**
- **SUI → Other chains**

### How to bridge:
1. Select **Bridge** from main menu
2. Choose source currency (SOL/ETH/BTC/SUI)
3. Enter amount to bridge
4. Receive unique deposit address
5. Send funds to deposit address
6. Track transaction status with **Refresh** button
7. Receive bridged assets in your SUI wallet

### Features:
- Real-time exchange rate calculation
- Unique deposit address per transaction
- Transaction status tracking
- Powered by ChangeNOW API for secure bridging

---

## 🚀 Roadmap

## Roadmap
- [ ] Add stop-loss & take-profit orders
- [x] Implement referral system with tiered rewards
- [x] Cross-chain bridge integration (SOL/ETH/BTC → SUI)
- [x] Copy trading functionality with customizable settings
- [ ] Support more DEXs beyond Cetus
- [ ] Add user analytics dashboard
- [ ] Implement referral leaderboard
- [ ] Mobile-optimized web dashboard
- [ ] Multi-language support
- [ ] Advanced copy trading filters (minimum volume, token filtering)
- [ ] Bridge transaction history and analytics
- [ ] Improve performance with caching layer

---

## 🛠️ Development

### Database Commands
```bash
# Create a new migration
npx prisma migrate dev --name your_migration_name

# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# View database in browser
npx prisma studio

# Generate Prisma Client after schema changes
npx prisma generate
```

### Useful Scripts
```bash
# Run in development with auto-reload
npm run dev

# Run tests
npm test

# Format code
npm run format
```

---

## 🤝 Contributing

PRs are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Telegraf](https://telegraf.js.org/) - Telegram Bot API framework
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [Sui](https://sui.io/) - Layer 1 blockchain
- [Cetus Protocol](https://www.cetus.zone/) - DEX on Sui
- [ChangeNOW](https://changenow.io/) - Cross-chain exchange API

---

## 📧 Support

For issues, questions, or suggestions:
- Open an [issue](https://github.com/GOODBADBOY10/centron-bot/issues)
- Contact: [@CentronBotCommunity](https://t.me/CentronBotCommunity)

---

## ⚡ Recent Updates

### v2.0.0 - Copy Trading & Bridge
- ✨ Added copy trading functionality with customizable settings
- 🌉 Integrated cross-chain bridge (SOL/ETH/BTC → SUI)
- 🔄 Real-time transaction status tracking
- 📊 Enhanced UI with cleaner message editing
- 🛡️ Improved security and error handling

---

**Made with ❤️ for the Sui ecosystem**