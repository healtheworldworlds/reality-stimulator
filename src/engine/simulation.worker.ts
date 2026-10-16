import {
  runMonteCarlo,
  type SimulationWorkerRequest,
  type SimulationWorkerResponse,
} from './simulation'

self.onmessage = (event: MessageEvent<SimulationWorkerRequest>) => {
  const { requestId, fixtures, picks, runs, rho } = event.data
  let response: SimulationWorkerResponse
  try {
    response = {
      requestId,
      type: 'complete',
      result: runMonteCarlo(fixtures, picks, runs, rho),
    }
  } catch (error) {
    response = {
      requestId,
      type: 'error',
      message: error instanceof Error ? error.message.slice(0, 300) : 'Simulation failed because of an unknown error.',
    }
  }
  self.postMessage(response)
}
