package datastore

import (
	"go.uber.org/fx"
)

// Module provides *ent.Client and *pgxpool.Pool to the fx graph.
func Modules() fx.Option {
	return fx.Options(
		fx.Provide(NewPool),
		fx.Provide(NewEntClient),
		fx.Invoke(migrate),
	)
}
