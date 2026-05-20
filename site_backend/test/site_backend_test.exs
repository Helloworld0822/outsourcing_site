defmodule SiteBackendTest do
  use ExUnit.Case
  doctest SiteBackend

  test "greets the world" do
    assert SiteBackend.hello() == :world
  end
end
