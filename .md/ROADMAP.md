# Project Roadmap

NutritionTracker is an extensible system. This document outlines the planned future phases, differentiating between short-term technical debt reduction and long-term architectural scaling.

## Phase 1: Short-Term Fixes (Next 3 Months)
- **TypeScript Migration:** Convert the legacy Daily Dozen JSX components (e.g., `App.jsx`, `Dashboard.jsx`) to strict TypeScript to eliminate runtime errors and improve developer velocity.
- **Enhanced Local Persistence:** Upgrade the Daily Dozen state manager to continuously synchronize transient state with `IndexedDB`, preventing data loss upon accidental tab closures.
- **VLM Prompt Optimization:** Refine the system prompts sent to Ollama to decrease hallucination rates on complex or multi-column nutrition labels.
- **PWA Enhancements:** Improve the Progressive Web App manifest and service worker caching strategies to allow full offline capability for the Daily Dozen tracker.

## Phase 2: Medium-Term Features (3 - 9 Months)
- **Barcode Database Expansion:** Integrate seamlessly with the Open Food Facts API (turning `SUGAR_PAI_ENABLE_OFF_LOOKUP=true` by default) to bypass the VLM entirely if a product is already known and verified.
- **Data Export & Reporting:** Implement comprehensive PDF and CSV reporting for users to share their Daily Dozen streaks and Sugar pAI logs with their dietitians.
- **Gamification:** Add streak counters, achievement badges, and weekly summary analytics to improve user retention.

## Phase 3: Long-Term Architectural Scaling (9+ Months)
- **Cloud Synchronization & Accounts:** Introduce an optional backend cloud layer (e.g., via OAuth and a PostgreSQL database) to allow users to sync their data seamlessly across mobile devices and desktops.
- **Mobile Application Wrapper:** Utilize React Native or Capacitor to package the application as a native iOS/Android application, granting deeper access to native camera APIs and push notifications.
- **Advanced Glycemic Modeling:** Partner with licensed nutritional databases to replace heuristic glycemic warnings with verified, scientifically-backed Glycemic Index (GI) and Glycemic Load (GL) data.