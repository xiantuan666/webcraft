/** 摔落伤害：前 4 格安全，之后约 0.6 血/格（宽松） */
export function fallDamage(vy: number): number {
  return Math.max(0, Math.round((vy * vy / 52 - 4) * 0.6));
}

/** 生存玩家状态：生命 + 饥饿 + 氧气 + 回血/扣血 */
export class PlayerState {
  health = 20;
  hunger = 20;
  breath = 10;
  readonly maxHealth = 20;
  readonly maxHunger = 20;
  readonly maxBreath = 10;
  private regenTimer = 0;
  private starveTimer = 0;
  private drownTimer = 0;

  tick(dt: number, active: boolean): void {
    const drainRate = active ? 1 / 90 : 1 / 240;
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
      if (this.starveTimer >= 5) {
        this.starveTimer = 0;
        this.health = Math.max(0, this.health - 1);
      }
    }
  }

  /** 水下呼吸：头在水中消耗氧气，耗尽后缓慢扣血；出水回复 */
  tickBreath(dt: number, underwater: boolean): void {
    if (underwater) {
      this.breath = Math.max(0, this.breath - dt / 1.5);
      if (this.breath <= 0) {
        this.drownTimer += dt;
        if (this.drownTimer >= 2) {
          this.drownTimer = 0;
          this.damage(1);
        }
      }
    } else {
      this.breath = Math.min(this.maxBreath, this.breath + dt * 2);
      this.drownTimer = 0;
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