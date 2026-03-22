# ⚙️ JavaScript Obfuscation for Next.js

This project demonstrates how to build a **Next.js application** and obfuscate its generated JavaScript chunks using **javascript-obfuscator**.

---

## 📦 Prerequisites

Install the obfuscator globally:

```bash
npm install -g javascript-obfuscator
```

---

## 🏗 Build the Project

Run the Next.js production build:

```bash
npx next build
```

After the build completes, obfuscate the generated JavaScript chunks:

```bash
javascript-obfuscator .next/static/chunks --output .next/static/chunks --compact true --identifier-names-generator hexadecimal --string-array true --string-array-encoding base64
```

---

## ⚙️ Environment Configuration

Modify the `.env` file according to your project configuration before running the application.

### Runtime env for shared `.next.zip`

`NEXT_PUBLIC_*` values are now injected at runtime from server env, not baked into static chunks.
This means you can share the built zip and let other users provide their own values before starting the app.

Required runtime keys:

- `NEXT_PUBLIC_BACKEND_API_BASE`
- `NEXT_PUBLIC_RSA_PUBLIC_KEY`
- `NEXT_PUBLIC_STATIC_FILES_BASE`
- `NEXT_PUBLIC_STATIC_BASIC_AUTH`

Examples:

```powershell
$env:NEXT_PUBLIC_BACKEND_API_BASE="https://api.example.com"
$env:NEXT_PUBLIC_RSA_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
$env:NEXT_PUBLIC_STATIC_FILES_BASE="https://static.example.com"
$env:NEXT_PUBLIC_STATIC_BASIC_AUTH="Basic xxxxx"
npx next start
```

Or place the same keys in `.env.local` in the extracted project, then run `npx next start`.

---

## ▶️ Run the Project

Install dependencies:

```bash
npm install
```

Start the production server:

```bash
npx next start
```

---

## 📂 Workflow Summary

```
Install Obfuscator → Build Next.js App → Obfuscate JS Chunks → Configure .env → Start Server
```

---

## 🔒 Obfuscation Features Used

- Compact code output  
- Hexadecimal identifier names  
- String array transformation  
- Base64 string encoding  

---

## 👤 Author

- **Biraj** - [Biraj2004](https://github.com/Biraj2004)
- **Anilabha** - [anilabhadatta](https://github.com/anilabhadatta)

---

## 📜 License

This project is for educational and development purposes.
