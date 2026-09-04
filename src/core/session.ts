export class Session {
  private generation = 0;
  private controller: AbortController | undefined;
  begin() {
    this.clear(); const generation = this.generation; this.controller = new AbortController();
    return { signal: this.controller.signal, current: () => generation === this.generation && !this.controller?.signal.aborted };
  }
  clear(): void { this.generation++; this.controller?.abort(); this.controller = undefined; }
}
