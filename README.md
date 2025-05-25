# Chartlamp Server

## Overview
ChartLamp Server is a Node.js project written in TypeScript.

## Environment
- **Node.js**
- **TypeScript**

## Prerequisites
- Node.js (version 20.10.0 or higher)
- Yarn (version 1.22.19 or higher)
- npm (version 8.19.4 or higher)

## Installation

1. Clone the repository:
   ```sh
   git clone <repository-url>
   cd <project-dir>

2. Install dependencies and run the project:
   ```sh
   npm install
   npm run dev

## Environment variables

| Name                      | Description | Default                                     |
|---------------------------| - |---------------------------------------------|
| APP_NAME                  | | ChartLamp                                   |
| API_KEY                   | |                                             |
| SERVER_URL                | |                                             |
| FRONTEND_URL              | |                                             |
| CORS_WHITELIST            | Comma separated | http://localhost:5000,http://localhost:3000 |
| MONGODB_CONNECTION_STRING | |                                             |
| REDIS_HOST                | | localhost                                   |
| REDIS_PORT                | |                                             |
| REDIS_PASSWORD            | |                                             |
| AWS_REGION                | |                                             |
| AWS_ACCESS_KEY_ID         | |                                             |
| AWS_SECRET                | |                                             |
| AWS_BUCKET_NAME           | | chartlamp                                   |
| OPENAI_API_KEY            | |                                             |
| SENDGRID_API_KEY          | |                                             |
| TWILIO_ACCOUNT_SID        | |                                             |
| TWILIO_AUTH_TOKEN         | |                                             |
| TWILIO_PHONE_NUMBER       | |                                             |
| FROM_EMAIL                | |                                             |