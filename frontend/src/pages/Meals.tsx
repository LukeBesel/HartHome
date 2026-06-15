import { useMemo, useState } from 'react';
import { UtensilsCrossed, ChevronLeft, ChevronRight, Plus, Trash2, Pencil, ShoppingCart, Clock, Users } from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import {
  PageHeader, Spinner, Modal, Field, Input, Textarea, Select, EmptyState, Segmented,
} from '../components/shared/ui';
import { fmtDate } from '../utils/format';
import type { Meal, Recipe } from '../types';

const MEAL_TYPES: Meal['meal_type'][] = ['breakfast', 'lunch', 'dinner', 'snack'];

const isoDate = (d: Date) => {
  const off = d.getTimezoneOffset();
  return new Date(+d - off * 60000).toISOString().slice(0, 10);
};

const sundayOf = (d: Date) => {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay());
  return s;
};

interface MealForm {
  id?: string;
  date: string;
  meal_type: Meal['meal_type'];
  title: string;
  recipe_id: string;
  notes: string;
}

interface RecipeForm {
  id?: string;
  name: string;
  description: string;
  prep_minutes: number;
  servings: number;
  tags: string;
  ingredients: string;
  instructions: string;
}

const blankMeal = (date?: string, type?: Meal['meal_type']): MealForm => ({
  date: date || isoDate(new Date()), meal_type: type || 'dinner', title: '', recipe_id: '', notes: '',
});

const blankRecipe = (): RecipeForm => ({
  name: '', description: '', prep_minutes: 30, servings: 4, tags: '', ingredients: '', instructions: '',
});

const ingredientsToText = (json: string): string => {
  try {
    const parsed = JSON.parse(json || '[]');
    if (Array.isArray(parsed)) return parsed.map((x: any) => (typeof x === 'string' ? x : x?.name || '')).filter(Boolean).join('\n');
  } catch { /* ignore */ }
  return '';
};

export default function Meals() {
  const { data: meals, loading, refresh } = useAsync(() => api.meals(), []);
  const { data: recipes, refresh: refreshRecipes } = useAsync(() => api.recipes(), []);

  const [tab, setTab] = useState<'plan' | 'recipes'>('plan');
  const [weekStart, setWeekStart] = useState(() => sundayOf(new Date()));

  const [mealModal, setMealModal] = useState(false);
  const [mealForm, setMealForm] = useState<MealForm>(blankMeal());
  const [savingMeal, setSavingMeal] = useState(false);

  const [recipeModal, setRecipeModal] = useState(false);
  const [recipeForm, setRecipeForm] = useState<RecipeForm>(blankRecipe());
  const [savingRecipe, setSavingRecipe] = useState(false);

  const recipeList = recipes || [];
  const allMeals = meals || [];

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; }),
    [weekStart],
  );
  const weekDateSet = useMemo(() => new Set(weekDays.map(isoDate)), [weekDays]);
  const visibleMeals = allMeals.filter((m) => weekDateSet.has(m.date));

  const weekStartISO = isoDate(weekDays[0]);
  const weekEndISO = isoDate(weekDays[6]);
  const weekLabel = `${fmtDate(weekStartISO, { month: 'short', day: 'numeric' })} – ${fmtDate(weekEndISO, { month: 'short', day: 'numeric' })}`;

  const shiftWeek = (delta: number) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + delta * 7); setWeekStart(d); };

  const generateGrocery = async () => {
    const res = await api.mealsToGrocery(weekStartISO, weekEndISO);
    alert(`Added ${res.added} items to your grocery list`);
  };

  const openCreateMeal = (date?: string, type?: Meal['meal_type']) => { setMealForm(blankMeal(date, type)); setMealModal(true); };
  const openEditMeal = (m: Meal) => {
    setMealForm({ id: m.id, date: m.date, meal_type: m.meal_type, title: m.title, recipe_id: m.recipe_id || '', notes: m.notes || '' });
    setMealModal(true);
  };

  const saveMeal = async () => {
    if (!mealForm.title.trim() || !mealForm.date) return;
    setSavingMeal(true);
    try {
      const body: Partial<Meal> = {
        date: mealForm.date,
        meal_type: mealForm.meal_type,
        title: mealForm.title.trim(),
        recipe_id: mealForm.recipe_id || null,
        notes: mealForm.notes,
      };
      if (mealForm.id) await api.updateMeal(mealForm.id, body);
      else await api.createMeal(body);
      setMealModal(false);
      await refresh();
    } finally {
      setSavingMeal(false);
    }
  };

  const deleteMeal = async () => {
    if (!mealForm.id) return;
    setSavingMeal(true);
    try { await api.deleteMeal(mealForm.id); setMealModal(false); await refresh(); }
    finally { setSavingMeal(false); }
  };

  const openCreateRecipe = () => { setRecipeForm(blankRecipe()); setRecipeModal(true); };
  const openEditRecipe = (r: Recipe) => {
    setRecipeForm({
      id: r.id,
      name: r.name,
      description: r.description || '',
      prep_minutes: r.prep_minutes,
      servings: r.servings,
      tags: r.tags || '',
      ingredients: ingredientsToText(r.ingredients),
      instructions: r.instructions || '',
    });
    setRecipeModal(true);
  };

  const saveRecipe = async () => {
    if (!recipeForm.name.trim()) return;
    setSavingRecipe(true);
    try {
      const body: Partial<Recipe> = {
        name: recipeForm.name.trim(),
        description: recipeForm.description,
        prep_minutes: Number(recipeForm.prep_minutes) || 0,
        servings: Number(recipeForm.servings) || 0,
        tags: recipeForm.tags,
        ingredients: JSON.stringify(
          recipeForm.ingredients.split('\n').map((s) => s.trim()).filter(Boolean).map((name) => ({ name })),
        ),
        instructions: recipeForm.instructions,
      };
      if (recipeForm.id) await api.updateRecipe(recipeForm.id, body);
      else await api.createRecipe(body);
      setRecipeModal(false);
      await refreshRecipes();
    } finally {
      setSavingRecipe(false);
    }
  };

  const deleteRecipe = async () => {
    if (!recipeForm.id) return;
    setSavingRecipe(true);
    try { await api.deleteRecipe(recipeForm.id); setRecipeModal(false); await refreshRecipes(); }
    finally { setSavingRecipe(false); }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Meals"
        subtitle={tab === 'plan' ? weekLabel : 'Your recipe box'}
        icon={UtensilsCrossed}
        actions={
          <>
            <Segmented
              options={[{ value: 'plan', label: 'Plan' }, { value: 'recipes', label: 'Recipes' }]}
              value={tab}
              onChange={setTab}
            />
            {tab === 'plan' ? (
              <>
                <div className="inline-flex items-center gap-1">
                  <button className="btn-ghost p-2" onClick={() => shiftWeek(-1)} aria-label="Previous week"><ChevronLeft size={18} /></button>
                  <button className="btn-secondary" onClick={() => setWeekStart(sundayOf(new Date()))}>This week</button>
                  <button className="btn-ghost p-2" onClick={() => shiftWeek(1)} aria-label="Next week"><ChevronRight size={18} /></button>
                </div>
                <button className="btn-secondary inline-flex items-center gap-1.5" onClick={generateGrocery}><ShoppingCart size={16} /> Generate grocery list</button>
                <button className="btn-primary" onClick={() => openCreateMeal()}><Plus size={16} /> Add meal</button>
              </>
            ) : (
              <button className="btn-primary" onClick={openCreateRecipe}><Plus size={16} /> New recipe</button>
            )}
          </>
        }
      />

      {tab === 'plan' ? (
        loading && !meals ? (
          <Spinner />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {weekDays.map((day) => {
              const dayISO = isoDate(day);
              const isToday = dayISO === isoDate(new Date());
              return (
                <div key={dayISO} className="card p-3 space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{day.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span className={`text-sm font-bold ${isToday ? '' : 'text-gray-700'}`} style={isToday ? { color: 'var(--accent)' } : undefined}>{day.getDate()}</span>
                  </div>
                  <div className="space-y-2">
                    {MEAL_TYPES.map((type) => {
                      const meal = visibleMeals.find((m) => m.date === dayISO && m.meal_type === type);
                      return (
                        <div key={type}>
                          <div className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider mb-0.5">{type}</div>
                          {meal ? (
                            <button onClick={() => openEditMeal(meal)} className="w-full text-left text-sm rounded-lg bg-gray-50 hover:bg-gray-100 px-2 py-1.5 text-gray-800 truncate transition-colors" title={meal.title}>
                              {meal.title}
                            </button>
                          ) : (
                            <button onClick={() => openCreateMeal(dayISO, type)} className="w-full text-left text-xs text-gray-300 hover:text-gray-500 px-2 py-1.5 transition-colors">
                              + add
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : recipeList.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="No recipes yet"
          message="Add recipes to plan meals faster."
          action={<button className="btn-primary" onClick={openCreateRecipe}><Plus size={16} /> New recipe</button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipeList.map((r) => (
            <div key={r.id} className="card card-hover p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-gray-900">{r.name}</h3>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button className="btn-ghost p-1.5" onClick={() => openEditRecipe(r)} aria-label="Edit"><Pencil size={15} /></button>
                </div>
              </div>
              {r.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{r.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-500 mt-3">
                <span className="inline-flex items-center gap-1"><Clock size={13} /> {r.prep_minutes} min</span>
                <span className="inline-flex items-center gap-1"><Users size={13} /> {r.servings}</span>
              </div>
              {r.tags && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {r.tags.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                    <span key={t} className="badge badge-gray">{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={mealModal}
        title={mealForm.id ? 'Edit meal' : 'Add meal'}
        onClose={() => setMealModal(false)}
        footer={
          <>
            {mealForm.id && <button className="btn-danger mr-auto" onClick={deleteMeal} disabled={savingMeal}><Trash2 size={16} /> Delete</button>}
            <button className="btn-secondary" onClick={() => setMealModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveMeal} disabled={savingMeal || !mealForm.title.trim()}>{savingMeal ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date">
            <Input type="date" value={mealForm.date} onChange={(e) => setMealForm({ ...mealForm, date: e.target.value })} />
          </Field>
          <Field label="Meal">
            <Select value={mealForm.meal_type} onChange={(e) => setMealForm({ ...mealForm, meal_type: e.target.value as Meal['meal_type'] })}>
              {MEAL_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Title">
          <Input value={mealForm.title} onChange={(e) => setMealForm({ ...mealForm, title: e.target.value })} placeholder="What's cooking?" />
        </Field>
        <Field label="Recipe" hint="Optional">
          <Select value={mealForm.recipe_id} onChange={(e) => setMealForm({ ...mealForm, recipe_id: e.target.value })}>
            <option value="">None</option>
            {recipeList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Notes" hint="Optional">
          <Textarea value={mealForm.notes} onChange={(e) => setMealForm({ ...mealForm, notes: e.target.value })} rows={2} />
        </Field>
      </Modal>

      <Modal
        open={recipeModal}
        title={recipeForm.id ? 'Edit recipe' : 'New recipe'}
        onClose={() => setRecipeModal(false)}
        wide
        footer={
          <>
            {recipeForm.id && <button className="btn-danger mr-auto" onClick={deleteRecipe} disabled={savingRecipe}><Trash2 size={16} /> Delete</button>}
            <button className="btn-secondary" onClick={() => setRecipeModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveRecipe} disabled={savingRecipe || !recipeForm.name.trim()}>{savingRecipe ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <Field label="Name">
          <Input value={recipeForm.name} onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })} placeholder="Recipe name" />
        </Field>
        <Field label="Description" hint="Optional">
          <Textarea value={recipeForm.description} onChange={(e) => setRecipeForm({ ...recipeForm, description: e.target.value })} rows={2} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prep minutes">
            <Input type="number" min={0} value={recipeForm.prep_minutes} onChange={(e) => setRecipeForm({ ...recipeForm, prep_minutes: Number(e.target.value) })} />
          </Field>
          <Field label="Servings">
            <Input type="number" min={0} value={recipeForm.servings} onChange={(e) => setRecipeForm({ ...recipeForm, servings: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Tags" hint="Comma separated">
          <Input value={recipeForm.tags} onChange={(e) => setRecipeForm({ ...recipeForm, tags: e.target.value })} placeholder="vegetarian, quick" />
        </Field>
        <Field label="Ingredients" hint="One ingredient per line">
          <Textarea value={recipeForm.ingredients} onChange={(e) => setRecipeForm({ ...recipeForm, ingredients: e.target.value })} rows={5} placeholder={'2 cups flour\n1 tsp salt'} />
        </Field>
        <Field label="Instructions" hint="Optional">
          <Textarea value={recipeForm.instructions} onChange={(e) => setRecipeForm({ ...recipeForm, instructions: e.target.value })} rows={4} />
        </Field>
      </Modal>
    </div>
  );
}
