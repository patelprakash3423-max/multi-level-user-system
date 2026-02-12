<<<<<<< HEAD
# 🚀 Multi-Level User Management System

A complete **MEAN stack application** with **N-level user hierarchy, balance transfer, and admin controls**.

---

## 📦 Deliverables Included

- ✔ Full source code (frontend + backend)
- ✔ Setup instructions (this README)
- ✔ API Endpoints
- ✔ GitHub repository

---

## 🛠 Tech Stack

### Backend
- Node.js + Express
- MongoDB Atlas + Mongoose
- JWT Authentication
- Bcrypt password hashing

### Frontend
- Angular
- Bootstrap UI
- RxJS + SweetAlert2

---

## ⚙️ System Requirements

- Node.js **v18+**
- npm **v9+**
- MongoDB Atlas account
- Angular CLI installed

---

## 🚀 Quick Start

### 1️⃣ Clone Repository

```bash
git clone https://github.com/patelprakash3423-max/multi-level-user-system
cd multi-level-user-system
```

---

### 2️⃣ Backend Setup

```bash
cd backend
npm install
cp .env.example .env
```

Update `.env` with your **MongoDB URI** and **JWT secrets**.

```bash
npm run seed
npm run dev
```

Backend runs at:

```
http://localhost:5000
```

---

### 3️⃣ Frontend Setup

```bash
cd ../frontend
npm install
ng serve
```

Frontend runs at:

```
http://localhost:4200
```

---

## 🔐 Default Login Credentials

| Role  | Email | Password |
|-------|-------|----------|
| Owner | owner@example.com | Owner@123 |
| Admin | admin@example.com | Admin@123 |

---

## 📘 API Documentation

All APIs are available under:

```
http://localhost:5000/api
```

### Main Modules

- Authentication (login, register, logout)
- User hierarchy & downline
- Balance transfer & statement
- Admin user management

👉 **Postman collection included in repository**  
Import it into Postman and set:

```
baseUrl = http://localhost:5000/api
```

---

## 🧪 Testing Steps

1. Get CAPTCHA  
2. Register user  
3. Login  
4. Create downline user  
5. Transfer balance  
6. View statement  
7. Admin credit balance  

---

## 📂 Project Structure

```
backend/    → Node.js API
frontend/   → Angular app
README.md   → Documentation
postman-collection.json → API testing
```

---

## 👨‍💻 Author

**Abhishek Kumar Patel**  
Full Stack Developer (MEAN Stack)

---

## 📜 License

MIT License © 2026


## 📡 API Endpoints

### Auth
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout

### Users
GET  /api/users/me
GET  /api/users/downline
POST /api/users/create

### Balance
GET  /api/balance
POST /api/balance/transfer
GET  /api/balance/statement

### Admin
GET  /api/admin/users
POST /api/admin/credit
POST /api/admin/debit
=======
# multi-level-user-system
>>>>>>> 0e549fc336e65f4cb1c26c3c46801cb26fa47cab
