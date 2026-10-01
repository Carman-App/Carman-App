/** The two ways a request fails, shared by the API client and the demo build's stand-in for it. */

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** The request never reached the server (offline, server down, DNS). */
export class NetworkError extends Error {
  constructor(message = 'Could not reach the Carma server.') {
    super(message)
    this.name = 'NetworkError'
  }
}
