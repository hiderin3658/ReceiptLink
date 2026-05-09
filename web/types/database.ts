// Supabase DB 型定義
// 実運用時は `supabase gen types typescript` で自動生成を推奨
// ここでは最小限の手書き型を定義
//
// NOTE: Phase 1 で OkazuLink 由来の以下を削除済み:
//   - レシピ系: Recipe, RecipeIngredient, SavedRecipe, RakutenRecipeCache,
//     Cuisine, CUISINES, CUISINE_LABEL, RecipeSource, EXTERNAL_RECIPE_PROVIDERS,
//     ExternalRecipeProvider, RECIPE_SOURCE_PREFERENCES, RecipeSourcePreference,
//     RECIPE_SOURCE_PREFERENCE_LABEL
//   - 食材マスタ: Food
//   - 栄養・体重: GoalType, GOAL_TYPES, GOAL_TYPE_LABEL,
//     UserProfile の goal_type / height_cm / target_weight_kg /
//     allergies / disliked_foods / default_recipe_source
//   - ShoppingItem.food_id（FK to foods）
//
// FOOD_CATEGORIES / FoodCategory / FOOD_CATEGORY_LABEL は当面残し、
// PR-3 で expense_categories ベースに置き換えた時点で削除する。

export type UserRole = "admin" | "user";

export interface AllowedUser {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  birth_year: number | null;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// 一時的な互換型: PR-3 で expense_categories ベースに置き換え予定
// =====================================================================
export const FOOD_CATEGORIES = [
  "vegetable",
  "meat",
  "fish",
  "dairy",
  "grain",
  "seasoning",
  "beverage",
  "sweet",
  "fruit",
  "egg",
  "other",
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const FOOD_CATEGORY_LABEL: Record<FoodCategory, string> = {
  vegetable: "野菜",
  meat: "肉",
  fish: "魚介",
  dairy: "乳製品",
  grain: "穀類",
  seasoning: "調味料",
  beverage: "飲料",
  sweet: "菓子",
  fruit: "果物",
  egg: "卵",
  other: "その他",
};

// =====================================================================
// shopping_records / shopping_items（PR-3 で expense_records / expense_items にリネーム予定）
// =====================================================================
export type ShoppingSource = "receipt" | "manual";

export interface ShoppingRecord {
  id: string;
  user_id: string;
  purchased_at: string; // YYYY-MM-DD
  store_name: string | null;
  total_amount: number;
  note: string | null;
  image_paths: string[];
  source_type: ShoppingSource;
  created_at: string;
}

export interface ShoppingItem {
  id: string;
  shopping_record_id: string;
  raw_name: string;
  display_name: string | null;
  category: FoodCategory;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number;
  discount: number;
  created_at: string;
}

// shopping_records と items を結合した表示用型
export type ShoppingRecordWithItems = ShoppingRecord & {
  shopping_items: ShoppingItem[];
};
