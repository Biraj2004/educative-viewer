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

## 📜 License

This project is for educational and development purposes.
