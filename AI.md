# AI Coding Guidelines for Lab Booking System

This project is a Next.js (App Router) application using React, Tailwind CSS v4, and Supabase. Follow these guidelines to maintain consistency and structure.

## 1. Tech Stack
- **Framework:** Next.js (App Router under `src/app/`)
- **Language:** JavaScript (`.js` and `.jsx`)
- **Styling:** Tailwind CSS v4
- **Backend & Auth:** Supabase (`@supabase/supabase-js`)

## 2. Project Structure
- `src/app/`: Contains all routing, pages, layouts, and API endpoints. Each directory name maps to a route (e.g., `src/app/booking/page.js`).
  - `src/app/api/`: All backend API routes using Next.js Route Handlers (`route.js`).
- `src/components/`: Reusable React components (e.g., `app-navbar.jsx`, `loader.jsx`).
- `src/lib/`: Utility functions, helper scripts, and backend clients (e.g., Supabase client configuration).

## 3. Code Formatting & Rules
- **Component Style:** Use functional components and modern React Hooks. Keep components small and modular.
- **File Extensions:** Use `.jsx` for files containing React components and JSX syntax. Use `.js` for utility/logic files, server actions, and route handlers.
- **Styling:** Rely solely on Tailwind CSS utility classes inside the `className` attribute. Avoid inline styles or custom CSS files unless strictly necessary.
- **Client vs Server Components:** Next.js App Router defaults to Server Components. You must add the `"use client"` directive at the very top of the file *only* if the component requires browser APIs, interactivity, or React hooks (e.g., `useState`, `useEffect`).
- **Data Fetching:** 
  - Prefer server-side data fetching directly in Server Components when possible.
  - Use the pre-configured Supabase client from `src/lib/supabase` for database and auth operations.
- **Environment Variables:** Access variables using `process.env.NEXT_PUBLIC_*` for the client side, and `process.env.*` for the server side securely.

## 4. API Routes
- Place API routes within `src/app/api/[route]/route.js`.
- Export standard HTTP methods natively: `export async function GET(request) {}`, `POST`, `PUT`, `DELETE`.
- Always return standard `NextResponse` objects and handle `try/catch` blocks strictly for error handling.

## 5. Clean Code Principles
- Ensure graceful error handling, especially during async operations and Supabase calls.
- Give variables and functions clear, descriptive names.
- Provide comments for complex logic blocks but avoid redundant comments.
