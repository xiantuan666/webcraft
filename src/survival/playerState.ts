/** 生存玩家状态：生命 + 饥饿 + 回血/扣血 */
export class PlayerState {
  health = 20;
  hunger = 20;
  readonly maxHealth = 20;
  readonly maxHunger = 20;
  private regenTimer = 0;
  private starveTimer = 0;

  tick(dt: number, active: boolean): void {
    const drainRate = active ? 1 / 70 : 1 / 200;
    this.hunger = Math.max(0, this.hunger - dt * drainRate);
    if (this.hunger >= 18 && this.health < this.maxHealth) {
      this.regenTimer += dt;
      if (this.regenTimer >= 4) {
        this.regenTimer = 0;
        this.health = Math.min(this.maxHealth, this.health + 1);
      }
    }
    if (this.hunger <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= 4) {
        this.starveTimer = 0;
        this.health = Math.max(0, this.health - 1);
      }
    }
  }

  damage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  eat(amount: number): void {
    this.hunger = Math.min(this.maxHunger, this.hunger + amount);
  }

  isDead(): boolean {
    return this.health <= 0;
  }
}