import { SPaTMessage } from '../../shared/types.js';

export class RoadsideUnit {
  private intersectionId: string;
  private currentPhase: 'RED' | 'YELLOW' | 'GREEN' = 'GREEN';
  private timeToChange: number = 10; // seconds
  private intervalId: NodeJS.Timeout | null = null;
  private onBroadcast: (message: SPaTMessage) => void;

  constructor(intersectionId: string, onBroadcast: (message: SPaTMessage) => void) {
    this.intersectionId = intersectionId;
    this.onBroadcast = onBroadcast;
  }

  public start() {
    // Tick every second to simulate the countdown and state transitions
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick() {
    this.timeToChange -= 1;

    if (this.timeToChange <= 0) {
      this.switchPhase();
    }

    const spat: SPaTMessage = {
      type: 'SPAT',
      intersectionId: this.intersectionId,
      timestamp: Date.now(),
      currentPhase: this.currentPhase,
      timeToChange: this.timeToChange,
      nextPhase: this.getNextPhase()
    };

    this.onBroadcast(spat);
  }

  private switchPhase() {
    switch (this.currentPhase) {
      case 'GREEN':
        this.currentPhase = 'YELLOW';
        this.timeToChange = 3;
        break;
      case 'YELLOW':
        this.currentPhase = 'RED';
        this.timeToChange = 10;
        break;
      case 'RED':
        this.currentPhase = 'GREEN';
        this.timeToChange = 12;
        break;
    }
  }

  private getNextPhase(): 'RED' | 'YELLOW' | 'GREEN' {
    switch (this.currentPhase) {
      case 'GREEN': return 'YELLOW';
      case 'YELLOW': return 'RED';
      case 'RED': return 'GREEN';
    }
  }

  public getStatus(): SPaTMessage {
    return {
      type: 'SPAT',
      intersectionId: this.intersectionId,
      timestamp: Date.now(),
      currentPhase: this.currentPhase,
      timeToChange: this.timeToChange,
      nextPhase: this.getNextPhase()
    };
  }
}
