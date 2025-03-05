/**
 * A weighted random integer generator that reduces the probability of selecting
 * the same integer consecutively.
 */
export default class WeightedRandomIntGenerator {
  /**
   * Creates a new weighted random integer generator.
   * @param {number} min - The minimum value (inclusive).
   * @param {number} max - The maximum value (inclusive).
   * @param {number} penaltyFactor - How strongly to penalize repeated selections (default: 0.5).
   * @param {number} recoveryRate - How quickly penalties recover (default: 0.3).
   */
  constructor(min, max, penaltyFactor = 0.2, recoveryRate = 0.3) {
    this.min = Math.floor(min)
    this.max = Math.floor(max)
    this.penaltyFactor = penaltyFactor
    this.recoveryRate = recoveryRate

    // Initialize weights for each possible integer in the range
    this.weights = {}
    for (let i = this.min; i <= this.max; i++) {
      this.weights[i] = 1 // Start with equal weights
    }

    this.lastPicked = null
  }

  /**
   * Selects a random integer within the specified range based on current weights.
   * @returns {number} A randomly selected integer.
   */
  _next() {
    // Calculate the sum of all weights
    let totalWeight = 0
    for (let i = this.min; i <= this.max; i++) {
      totalWeight += this.weights[i]
    }

    // Generate a random value between 0 and the total weight
    const randomValue = Math.random() * totalWeight

    // Find which integer this random value corresponds to
    let cumulativeWeight = 0
    for (let i = this.min; i <= this.max; i++) {
      cumulativeWeight += this.weights[i]
      if (randomValue <= cumulativeWeight) {
        // Apply penalty to the selected integer
        this.applyPenalty(i)
        // Recover weights for non-selected integers
        this.recoverWeights(i)

        this.lastPicked = i
        return i
      }
    }

    // Fallback (should never reach here under normal circumstances)
    return this.max
  }

  next() {
    const value = this._next()
    console.log(`Generated: ${value}, Weights: ${JSON.stringify(this.getWeights())}`)
    return value
  }

  /**
   * Reduces the weight of the selected integer.
   * @param {number} selected - The integer that was just selected.
   * @private
   */
  applyPenalty(selected) {
    // If the same number is selected consecutively, the penalty increases
    if (selected === this.lastPicked) {
      this.weights[selected] *= 1 - this.penaltyFactor
    } else {
      // First time selection penalty
      this.weights[selected] *= 1 - this.penaltyFactor / 2
    }

    // Ensure the weight doesn't go too low
    this.weights[selected] = Math.max(0.1, this.weights[selected])
  }

  /**
   * Increases the weights of non-selected integers to help them recover.
   * @param {number} selected - The integer that was just selected.
   * @private
   */
  recoverWeights(selected) {
    for (let i = this.min; i <= this.max; i++) {
      if (i !== selected) {
        this.weights[i] += this.weights[i] * this.recoveryRate

        // Optional: Cap the maximum weight to prevent extreme biases
        this.weights[i] = Math.min(2, this.weights[i])
      }
    }
  }

  /**
   * Resets all weights to their initial values.
   */
  reset() {
    for (let i = this.min; i <= this.max; i++) {
      this.weights[i] = 1
    }
    this.lastPicked = null
  }

  /**
   * Returns the current weights for all integers in the range.
   * @returns {Object} An object mapping integers to their current weights.
   */
  getWeights() {
    return { ...this.weights }
  }
}

// Example usage:
// const generator = new WeightedRandomIntGenerator(0, 3);
// for (let i = 0; i < 20; i++) {
//   const value = generator.next();
//   console.log(`Generated: ${value}, Weights: ${JSON.stringify(generator.getWeights())}`);
// }
