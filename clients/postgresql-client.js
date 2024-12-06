import pg from 'pg'
const { Client } = pg

export default class PostgresClient {
  constructor(config = {}) {
    this.client = new Client({
      user: config.user || 'postgres',
      host: config.host || 'localhost',
      database: config.database || 'postgres',
      password: config.password || '',
      port: config.port || 5432
    })
  }

  async connect() {
    try {
      await this.client.connect()
      console.log('Connected to PostgreSQL')
    } catch (err) {
      console.error('Connection error:', err)
      throw err
    }
  }

  async query(text, params) {
    try {
      return await this.client.query(text, params)
    } catch (err) {
      console.error('Query error:', err)
      throw err
    }
  }

  async close() {
    try {
      await this.client.end()
      console.log('Connection closed')
    } catch (err) {
      console.error('Error closing connection:', err)
      throw err
    }
  }
}

// Usage example:
// import PostgresClient from './PostgresClient.js'
// 
// const db = new PostgresClient({
//   user: 'myuser',
//   password: 'mypassword',
//   database: 'mydatabase'
// })
// 
// await db.connect()
// const result = await db.query('SELECT NOW()')
// console.log(result.rows)