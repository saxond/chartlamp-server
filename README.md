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
   
## Tests

1. Start the mongodb container:
    ```sh
    docker-compose up mongo redis &
   
2. Run the tests:
   
    ```sh
    MONGODB_CONNECTION_STRING=mongodb://localhost:27017/test npm test