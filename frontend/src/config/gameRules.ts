export const GAME_RULES = {
    // Probability of a bud blooming into a fruit (1 in N)
    // Higher N = rarer fruit, larger trees.
    FRUIT_FREQUENCY: 100n,

    // The base amount of vitality required to bloom a bud.
    VITALITY_REQUIRED_BASE: 256n,

    // Cost in lamports to nurture a bud (sent to prize pool)
    NURTURE_COST_LAMPORTS: 600_000,
};
