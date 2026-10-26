import { SimulationEnvironment } from './types';

class SimulationRegistry {
  private environments = new Map<string, SimulationEnvironment>();

  register(env: SimulationEnvironment) {
    if (!env || !env.id) return;
    this.environments.set(env.id, env);
  }

  get(id: string): SimulationEnvironment | undefined {
    return this.environments.get(id);
  }

  getAll(): SimulationEnvironment[] {
    return Array.from(this.environments.values());
  }
}

export const simRegistry = new SimulationRegistry();

export function registerSimulation(env: SimulationEnvironment) {
  simRegistry.register(env);
}

export function getSimEnvironment<TState = any>(id: string): SimulationEnvironment<TState> | undefined {
  return simRegistry.get(id) as SimulationEnvironment<TState> | undefined;
}

export function getAllSimEnvironments(): SimulationEnvironment[] {
  return simRegistry.getAll();
}


