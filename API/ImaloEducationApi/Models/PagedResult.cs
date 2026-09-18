namespace ImaloEducationApi.Models;

public class PagedResult<T>
{
    public int PageNumber { get; set; }

    public int PageSize { get; set; }

    public int TotalItems { get; set; }

    public List<T> Items { get; set; } = new();
}
